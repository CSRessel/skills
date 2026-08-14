use anyhow::Result;
use serde_json::json;

use crate::event::{Event, Flag};
use crate::screen::{Mode, Position, Screen};

pub fn screen(screen: &Screen, json_output: bool) -> Result<String> {
    if json_output {
        return Ok(serde_json::to_string(&json!({
            "mode": screen.mode,
            "message": screen.last_message(),
            "status": screen.status,
            "player": screen.player,
            "pet": screen.pet,
            "near": neighborhood(screen),
        }))?);
    }
    let Some(status) = &screen.status else {
        let mut output = format!("PROMPT {:?}", screen.mode);
        if let Some(message) = screen.last_message() {
            output.push_str(&format!("\nmsg: {message}"));
        }
        return Ok(output);
    };
    let mut lines = vec![format!(
        "T{} Dlvl{} HP{}/{} Pw{}/{} AC{} XP{}/{} ${}",
        status.turn,
        status.dungeon_level,
        status.hp.current,
        status.hp.max,
        status.power.current,
        status.power.max,
        status.ac,
        status.experience_level,
        status.experience_points,
        status.gold,
    )];
    if let Some(message) = screen.last_message() {
        lines.push(format!("msg: {message}"));
    }
    lines.push(format!("pos: {}", position(screen.player)));
    lines.push(format!("pet: {}", pet(screen)));
    let near = neighborhood_text(screen);
    if !near.is_empty() {
        lines.push(format!("near: {near}"));
    }
    if screen.mode != Mode::Normal {
        lines.push(format!("mode: {:?}", screen.mode));
    }
    Ok(lines.join("\n"))
}

pub fn event(event: &Event, after: &Screen, json_output: bool) -> Result<String> {
    if json_output {
        return Ok(serde_json::to_string(event)?);
    }
    let label = if event.flags.contains(&Flag::HpLoss) || event.flags.contains(&Flag::UnknownMode) {
        "ALERT"
    } else if event.flags.contains(&Flag::Combat) {
        "COMBAT"
    } else if event.flags.contains(&Flag::Prompt) {
        "PROMPT"
    } else if event.moved {
        "MOVED"
    } else if event.flags.contains(&Flag::Message) {
        "MESSAGE"
    } else {
        "NOOP"
    };
    let mut lines = vec![format!(
        "{label} T{}→{}{}",
        optional(event.turn_before),
        optional(event.turn_after),
        flags(event)
    )];
    if event.moved {
        lines.push(format!(
            "move: {}→{}",
            position(event.player_before),
            position(event.player_after)
        ));
    }
    if event.hp_before != event.hp_after {
        lines.push(format!(
            "hp: {}→{}",
            optional(event.hp_before),
            optional(event.hp_after)
        ));
    }
    if let Some(message) = &event.message {
        lines.push(format!("msg: {message}"));
    }
    lines.push(format!("pet: {}", pet(after)));
    if label != "NOOP" {
        let near = neighborhood_text(after);
        if !near.is_empty() {
            lines.push(format!("near: {near}"));
        }
    }
    Ok(lines.join("\n"))
}

pub fn map(screen: &Screen) -> String {
    screen
        .map
        .iter()
        .enumerate()
        .filter(|(_, row)| !row.trim().is_empty())
        .map(|(index, row)| format!("{index:02}|{row}"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn flags(event: &Event) -> String {
    let values = event
        .flags
        .iter()
        .filter(|flag| **flag != Flag::Message)
        .map(|flag| format!("{flag:?}").to_ascii_uppercase())
        .collect::<Vec<_>>();
    if values.is_empty() {
        String::new()
    } else {
        format!(" [{}]", values.join(","))
    }
}

fn neighborhood(screen: &Screen) -> serde_json::Value {
    json!(
        screen
            .neighborhood()
            .into_iter()
            .map(|(name, glyph)| (name, visible(glyph)))
            .collect::<Vec<_>>()
    )
}

fn neighborhood_text(screen: &Screen) -> String {
    screen
        .neighborhood()
        .into_iter()
        .map(|(name, glyph)| format!("{name}={}", visible(glyph)))
        .collect::<Vec<_>>()
        .join(" ")
}

fn position(value: Option<Position>) -> String {
    value.map_or_else(|| "?".to_owned(), |p| format!("{},{}", p.x, p.y))
}

fn pet(screen: &Screen) -> String {
    match (screen.player, screen.pet) {
        (_, None) => "not visible".to_owned(),
        (None, Some(pet)) => format!("{},{}", pet.x, pet.y),
        (Some(player), Some(pet)) => {
            let dx = pet.x as isize - player.x as isize;
            let dy = pet.y as isize - player.y as isize;
            format!("{} distance {}", direction(dx, dy), player.distance(pet))
        }
    }
}

fn direction(dx: isize, dy: isize) -> &'static str {
    match (dx.signum(), dy.signum()) {
        (-1, -1) => "NW",
        (0, -1) => "N",
        (1, -1) => "NE",
        (-1, 0) => "W",
        (0, 0) => "here",
        (1, 0) => "E",
        (-1, 1) => "SW",
        (0, 1) => "S",
        (1, 1) => "SE",
        _ => "?",
    }
}

fn visible(glyph: char) -> String {
    if glyph == ' ' {
        "space".to_owned()
    } else {
        glyph.to_string()
    }
}

fn optional<T: std::fmt::Display>(value: Option<T>) -> String {
    value.map_or_else(|| "?".to_owned(), |value| value.to_string())
}
