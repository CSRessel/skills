use std::sync::LazyLock;

use anyhow::{Context, Result, bail};
use regex::Regex;
use serde::{Deserialize, Serialize};
use unicode_width::UnicodeWidthChar;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Position {
    pub x: usize,
    pub y: usize,
}

impl Position {
    pub fn distance(self, other: Self) -> usize {
        self.x.abs_diff(other.x).max(self.y.abs_diff(other.y))
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Pool {
    pub current: i32,
    pub max: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Status {
    pub dungeon_level: String,
    pub gold: u64,
    pub hp: Pool,
    pub power: Pool,
    pub ac: i32,
    pub experience_level: u32,
    pub experience_points: u64,
    pub turn: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Normal,
    More,
    DirectionPrompt,
    FarLook,
    Inventory,
    Menu,
    YesNo,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Screen {
    pub mode: Mode,
    pub messages: Vec<String>,
    pub status: Option<Status>,
    pub map: Vec<String>,
    pub player: Option<Position>,
    pub pet: Option<Position>,
}

impl Screen {
    pub fn last_message(&self) -> Option<&str> {
        self.messages.last().map(String::as_str)
    }

    pub fn turn(&self) -> Option<u64> {
        self.status.as_ref().map(|status| status.turn)
    }

    pub fn neighborhood(&self) -> Vec<(&'static str, char)> {
        let Some(player) = self.player else {
            return Vec::new();
        };
        const DIRECTIONS: [(&str, isize, isize); 8] = [
            ("NW", -1, -1),
            ("N", 0, -1),
            ("NE", 1, -1),
            ("W", -1, 0),
            ("E", 1, 0),
            ("SW", -1, 1),
            ("S", 0, 1),
            ("SE", 1, 1),
        ];
        DIRECTIONS
            .into_iter()
            .map(|(name, dx, dy)| {
                let x = player.x.checked_add_signed(dx);
                let y = player.y.checked_add_signed(dy);
                let glyph = match (x, y) {
                    (Some(x), Some(y)) => self.glyph_at(x, y).unwrap_or(' '),
                    _ => ' ',
                };
                (name, glyph)
            })
            .collect()
    }

    pub fn glyph_at(&self, x: usize, y: usize) -> Option<char> {
        let row = self.map.get(y)?;
        char_at_column(row, x)
    }
}

pub fn parse(raw: &str, player_glyph: char, pet_glyph: char) -> Result<Screen> {
    parse_with_hints(raw, player_glyph, pet_glyph, None, None)
}

pub fn parse_with_hints(
    raw: &str,
    player_glyph: char,
    pet_glyph: char,
    player_hint: Option<Position>,
    pet_hint: Option<Position>,
) -> Result<Screen> {
    let cleaned = strip_ansi(raw);
    let lines: Vec<&str> = cleaned.lines().collect();
    if lines.is_empty() {
        bail!("empty capture");
    }

    let status_index = lines
        .iter()
        .position(|line| line.trim_start().starts_with("Dlvl:"));
    let status = status_index
        .map(|index| parse_status(lines[index]))
        .transpose()?;
    let character_index = lines
        .iter()
        .position(|line| line.contains(" the ") && line.contains("St:"));
    let map_end = character_index.or(status_index).unwrap_or(lines.len());

    let mode = detect_mode(&cleaned, status.is_some());
    let mut messages = Vec::new();
    let mut first_map = None;
    for (index, line) in lines[..map_end].iter().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        if !line.starts_with(char::is_whitespace) {
            messages.push(line.trim().to_owned());
        } else if first_map.is_none() {
            first_map = Some(index);
        }
    }

    let map = if let Some(start) = first_map {
        let mut rows = vec![String::new(); start];
        rows.extend(
            lines[start..map_end]
                .iter()
                .map(|line| line.trim_end().to_owned()),
        );
        rows
    } else {
        Vec::new()
    };

    let player = resolve_position(&map, player_glyph, player_hint);
    let pet = resolve_position(&map, pet_glyph, pet_hint);
    Ok(Screen {
        mode,
        messages,
        status,
        map,
        player,
        pet,
    })
}

fn detect_mode(raw: &str, has_status: bool) -> Mode {
    if raw.contains("--More--") {
        Mode::More
    } else if raw.contains("What type of object do you want an inventory of?") {
        Mode::Inventory
    } else if raw.contains("Pick an object") || raw.contains("Move the cursor") {
        Mode::FarLook
    } else if raw.contains("In what direction") || raw.contains("What direction") {
        Mode::DirectionPrompt
    } else if raw.contains("[yn") || raw.contains("(y/n)") {
        Mode::YesNo
    } else if raw.contains("(end)") || raw.contains("Pick one of these") {
        Mode::Menu
    } else if has_status {
        Mode::Normal
    } else {
        Mode::Unknown
    }
}

fn parse_status(line: &str) -> Result<Status> {
    static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(
        r"Dlvl:(\S+) \$:(\d+) HP:(-?\d+)\((-?\d+)\) Pw:(-?\d+)\((-?\d+)\) AC:(-?\d+) Xp:(\d+)/(\d+) T:(\d+)",
    ).expect("valid status regex")
    });
    let captures = PATTERN
        .captures(line)
        .with_context(|| format!("unrecognized status line: {line:?}"))?;
    let number = |index: usize| -> Result<i32> {
        captures[index]
            .parse()
            .with_context(|| format!("parse status field {index}"))
    };
    Ok(Status {
        dungeon_level: captures[1].to_owned(),
        gold: captures[2].parse()?,
        hp: Pool {
            current: number(3)?,
            max: number(4)?,
        },
        power: Pool {
            current: number(5)?,
            max: number(6)?,
        },
        ac: number(7)?,
        experience_level: captures[8].parse()?,
        experience_points: captures[9].parse()?,
        turn: captures[10].parse()?,
    })
}

fn resolve_position(map: &[String], glyph: char, hint: Option<Position>) -> Option<Position> {
    let mut found = Vec::new();
    for (y, row) in map.iter().enumerate() {
        let mut x = 0;
        for value in row.chars() {
            if value == glyph {
                found.push(Position { x, y });
            }
            x += UnicodeWidthChar::width(value).unwrap_or(0);
        }
    }
    match found.as_slice() {
        [] => None,
        [only] => Some(*only),
        many => hint.and_then(|hint| {
            let minimum = many.iter().map(|position| position.distance(hint)).min()?;
            let nearest: Vec<_> = many
                .iter()
                .copied()
                .filter(|position| position.distance(hint) == minimum)
                .collect();
            (nearest.len() == 1).then_some(nearest[0])
        }),
    }
}

fn char_at_column(row: &str, target: usize) -> Option<char> {
    let mut column = 0;
    for value in row.chars() {
        let width = UnicodeWidthChar::width(value).unwrap_or(0);
        if column == target {
            return Some(value);
        }
        if column < target && target < column + width {
            return Some(value);
        }
        column += width;
    }
    None
}

fn strip_ansi(input: &str) -> String {
    static ANSI: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"\x1b\[[0-?]*[ -/]*[@-~]").expect("valid ANSI regex"));
    ANSI.replace_all(input, "").into_owned()
}
