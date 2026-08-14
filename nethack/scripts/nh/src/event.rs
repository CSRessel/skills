use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::screen::{Mode, Position, Screen};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Flag {
    Combat,
    HpLoss,
    Message,
    PetHidden,
    Prompt,
    UnknownMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Event {
    pub turn_before: Option<u64>,
    pub turn_after: Option<u64>,
    pub player_before: Option<Position>,
    pub player_after: Option<Position>,
    pub pet_after: Option<Position>,
    pub message: Option<String>,
    pub hp_before: Option<i32>,
    pub hp_after: Option<i32>,
    pub mode: Mode,
    pub moved: bool,
    pub flags: BTreeSet<Flag>,
}

impl Event {
    pub fn derive(before: &Screen, after: &Screen) -> Self {
        let hp_before = before.status.as_ref().map(|status| status.hp.current);
        let hp_after = after.status.as_ref().map(|status| status.hp.current);
        let message = (after.last_message() != before.last_message())
            .then(|| after.last_message().map(str::to_owned))
            .flatten();
        let mut flags = BTreeSet::new();
        if message.is_some() {
            flags.insert(Flag::Message);
        }
        if message.as_deref().is_some_and(is_combat_message) {
            flags.insert(Flag::Combat);
        }
        if hp_after
            .zip(hp_before)
            .is_some_and(|(after, before)| after < before)
        {
            flags.insert(Flag::HpLoss);
        }
        if before.pet.is_some() && after.pet.is_none() {
            flags.insert(Flag::PetHidden);
        }
        if after.mode != Mode::Normal {
            flags.insert(Flag::Prompt);
        }
        if after.mode == Mode::Unknown {
            flags.insert(Flag::UnknownMode);
        }
        Self {
            turn_before: before.turn(),
            turn_after: after.turn(),
            player_before: before.player,
            player_after: after.player,
            pet_after: after.pet,
            message,
            hp_before,
            hp_after,
            mode: after.mode,
            moved: before.player != after.player,
            flags,
        }
    }
}

fn is_combat_message(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    [
        " hits",
        " misses",
        " bites",
        " attacks",
        " kicks",
        " stings",
        " kill",
        "you hit",
        "you miss",
        "you attack",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

#[derive(Debug, Default)]
pub struct SafetyPolicy {
    consecutive_pet_hidden: u8,
}

impl SafetyPolicy {
    pub fn observe(&mut self, event: &Event, after: &Screen) -> bool {
        self.consecutive_pet_hidden = if after.pet.is_none() {
            self.consecutive_pet_hidden.saturating_add(1)
        } else {
            0
        };
        event.flags.contains(&Flag::Prompt)
            || event.flags.contains(&Flag::Combat)
            || event.flags.contains(&Flag::HpLoss)
            || event.flags.contains(&Flag::UnknownMode)
            || self.consecutive_pet_hidden >= 2
    }
}
