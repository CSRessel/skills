use std::path::PathBuf;

use clap::{Parser, Subcommand};

use crate::session::DEFAULT_SESSION;
use crate::state::default_path;

#[derive(Debug, Parser)]
#[command(name = "nh", version, about)]
pub struct Cli {
    #[arg(long, default_value = DEFAULT_SESSION, env = "NH_SESSION")]
    pub session: String,

    #[arg(long, env = "NH_SCRIPTS")]
    pub scripts: Option<PathBuf>,

    #[arg(long, default_value_os_t = default_path(), env = "NH_STATE")]
    pub state: PathBuf,

    #[arg(long, default_value = "h", value_parser = parse_glyph)]
    pub player_glyph: char,

    #[arg(long, default_value = "f", value_parser = parse_glyph)]
    pub pet_glyph: char,

    #[arg(long, global = true)]
    pub json: bool,

    #[command(subcommand)]
    pub command: Option<Command>,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Show compact current state (the default command).
    Status,
    /// Send one atomic action and print the resulting event.
    Do {
        input: String,
        #[arg(long, default_value_t = 1000)]
        timeout_ms: u64,
    },
    /// Repeat one atomic action, observing and applying safety policy after each step.
    Run {
        count: u32,
        input: String,
        #[arg(long, default_value_t = 1000)]
        timeout_ms: u64,
    },
    /// Show the trimmed map with terminal-row coordinates.
    Map,
    /// Show the exact terminal capture.
    Raw,
    /// Parse a saved terminal capture without touching the live session.
    Parse { path: PathBuf },
}

fn parse_glyph(value: &str) -> Result<char, String> {
    let mut chars = value.chars();
    let Some(glyph) = chars.next() else {
        return Err("glyph must not be empty".to_owned());
    };
    if chars.next().is_some() {
        return Err("glyph must be one character".to_owned());
    }
    Ok(glyph)
}
