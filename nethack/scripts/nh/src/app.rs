use std::fs;
use std::time::Duration;

use anyhow::{Context, Result, bail};

use crate::cli::{Cli, Command};
use crate::event::{Event, SafetyPolicy};
use crate::input::Input;
use crate::render;
use crate::screen::{Screen, parse, parse_with_hints};
use crate::session::Session;
use crate::state::{SavedState, load, save};

pub fn run(cli: Cli) -> Result<()> {
    match cli.command.as_ref().unwrap_or(&Command::Status) {
        Command::Parse { path } => {
            let raw =
                fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
            println!(
                "{}",
                render::screen(&parse(&raw, cli.player_glyph, cli.pet_glyph)?, cli.json)?
            );
        }
        command => run_live(&cli, command)?,
    }
    Ok(())
}

fn run_live(cli: &Cli, command: &Command) -> Result<()> {
    let session = Session::discover(cli.session.clone(), cli.scripts.as_deref())?;
    match command {
        Command::Status => {
            let screen = capture(cli, &session, None)?;
            persist(cli, &screen)?;
            println!("{}", render::screen(&screen, cli.json)?);
        }
        Command::Raw => print!("{}", session.capture()?),
        Command::Map => println!("{}", render::map(&capture(cli, &session, None)?)),
        Command::Do { input, timeout_ms } => {
            let input = Input::parse(input)?;
            let (after, event) = act(cli, &session, &input, *timeout_ms, None)?;
            println!("{}", render::event(&event, &after, cli.json)?);
        }
        Command::Run {
            count,
            input,
            timeout_ms,
        } => {
            let input = Input::parse(input)?;
            let mut previous = None;
            let mut policy = SafetyPolicy::default();
            for _ in 0..*count {
                let (after, event) = act(cli, &session, &input, *timeout_ms, previous.as_ref())?;
                println!("{}", render::event(&event, &after, cli.json)?);
                let stop = policy.observe(&event, &after);
                previous = Some(after);
                if stop {
                    break;
                }
            }
        }
        Command::Parse { .. } => unreachable!(),
    }
    Ok(())
}

fn act(
    cli: &Cli,
    session: &Session,
    input: &Input,
    timeout_ms: u64,
    previous: Option<&Screen>,
) -> Result<(Screen, Event)> {
    let before_raw = session.capture()?;
    let before = capture_from_raw(cli, &before_raw, previous)?;
    if !input.allowed_in(before.mode) {
        bail!("refusing input: current mode is {:?}", before.mode);
    }
    session.send(input)?;
    let after_raw = session.capture_after_change(&before_raw, Duration::from_millis(timeout_ms))?;
    let after = capture_from_raw(cli, &after_raw, Some(&before))?;
    let event = Event::derive(&before, &after);
    persist(cli, &after)?;
    Ok((after, event))
}

fn capture(cli: &Cli, session: &Session, previous: Option<&Screen>) -> Result<Screen> {
    capture_from_raw(cli, &session.capture()?, previous)
}

fn capture_from_raw(cli: &Cli, raw: &str, previous: Option<&Screen>) -> Result<Screen> {
    let saved = if previous.is_none() {
        load(&cli.state)?.filter(|state| state.session == cli.session)
    } else {
        None
    };
    parse_with_hints(
        raw,
        cli.player_glyph,
        cli.pet_glyph,
        previous
            .and_then(|screen| screen.player)
            .or_else(|| saved.as_ref().and_then(|state| state.player)),
        previous
            .and_then(|screen| screen.pet)
            .or_else(|| saved.as_ref().and_then(|state| state.pet)),
    )
}

fn persist(cli: &Cli, screen: &Screen) -> Result<()> {
    save(
        &cli.state,
        &SavedState {
            session: cli.session.clone(),
            status: screen.status.clone(),
            player: screen.player,
            pet: screen.pet,
            mode: screen.mode,
            last_message: screen.last_message().map(str::to_owned),
        },
    )
}
