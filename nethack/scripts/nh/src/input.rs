use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};

use crate::screen::Mode;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum Input {
    Literal(char),
    Special(SpecialKey),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpecialKey {
    Escape,
    Enter,
    Space,
    Kick,
}

impl Input {
    pub fn parse(value: &str) -> Result<Self> {
        let input = match value.to_ascii_lowercase().as_str() {
            "north" => Self::Literal('k'),
            "south" => Self::Literal('j'),
            "east" => Self::Literal('l'),
            "west" => Self::Literal('h'),
            "northeast" | "ne" => Self::Literal('u'),
            "northwest" | "nw" => Self::Literal('y'),
            "southeast" | "se" => Self::Literal('n'),
            "southwest" | "sw" => Self::Literal('b'),
            "wait" => Self::Literal('.'),
            "escape" => Self::Special(SpecialKey::Escape),
            "enter" => Self::Special(SpecialKey::Enter),
            "space" => Self::Special(SpecialKey::Space),
            "kick" | "ctrl-d" => Self::Special(SpecialKey::Kick),
            _ => {
                let mut chars = value.chars();
                match (chars.next(), chars.next()) {
                    (Some(key), None) if !key.is_control() => Self::Literal(key),
                    _ => bail!(
                        "input must be one literal key, a direction, wait, escape, enter, space, or kick; use `nh run COUNT INPUT` to repeat"
                    ),
                }
            }
        };
        Ok(input)
    }

    pub fn allowed_in(&self, mode: Mode) -> bool {
        if mode == Mode::Unknown {
            return false;
        }
        if mode == Mode::Normal {
            return true;
        }
        if matches!(
            self,
            Self::Special(SpecialKey::Escape | SpecialKey::Enter | SpecialKey::Space)
        ) {
            return true;
        }
        match mode {
            Mode::DirectionPrompt => matches!(
                self,
                Self::Literal('y' | 'k' | 'u' | 'h' | 'l' | 'b' | 'j' | 'n' | '.')
            ),
            Mode::YesNo => matches!(self, Self::Literal('y' | 'n' | 'q')),
            _ => false,
        }
    }

    pub fn literal(&self) -> Option<String> {
        match self {
            Self::Literal(key) => Some(key.to_string()),
            Self::Special(_) => None,
        }
    }

    pub fn special_name(&self) -> Option<&'static str> {
        match self {
            Self::Special(SpecialKey::Escape) => Some("Escape"),
            Self::Special(SpecialKey::Enter) => Some("Enter"),
            Self::Special(SpecialKey::Space) => Some("Space"),
            Self::Special(SpecialKey::Kick) => Some("C-d"),
            Self::Literal(_) => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_letters_keep_nethack_meaning() {
        assert_eq!(Input::parse("s").unwrap(), Input::Literal('s'));
        assert_eq!(Input::parse("n").unwrap(), Input::Literal('n'));
        assert_eq!(Input::parse("south").unwrap(), Input::Literal('j'));
    }

    #[test]
    fn rejects_unobserved_key_batches() {
        assert!(Input::parse("6l").is_err());
    }

    #[test]
    fn prompt_permissions_are_explicit() {
        assert!(Input::parse("space").unwrap().allowed_in(Mode::More));
        assert!(
            Input::parse("west")
                .unwrap()
                .allowed_in(Mode::DirectionPrompt)
        );
        assert!(Input::parse("y").unwrap().allowed_in(Mode::YesNo));
        assert!(!Input::parse("s").unwrap().allowed_in(Mode::YesNo));
    }

    #[test]
    fn unknown_mode_rejects_all_input() {
        for input in ["escape", "enter", "space", "y", "north"] {
            assert!(
                !Input::parse(input).unwrap().allowed_in(Mode::Unknown),
                "unknown mode accepted {input}"
            );
        }
    }
}
