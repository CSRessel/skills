use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{Context, Result, bail};

use crate::input::Input;

pub const DEFAULT_SESSION: &str = "nethack-together";

#[derive(Debug, Clone)]
pub struct Session {
    pub name: String,
    pub scripts: PathBuf,
}

impl Session {
    pub fn new(name: impl Into<String>, scripts: impl Into<PathBuf>) -> Self {
        Self {
            name: name.into(),
            scripts: scripts.into(),
        }
    }

    pub fn discover(name: impl Into<String>, configured: Option<&Path>) -> Result<Self> {
        let scripts = if let Some(path) = configured {
            path.to_owned()
        } else {
            discover_scripts().context(
                "could not find tui-puppeteering-with-tmux helpers; set --scripts or NH_SCRIPTS",
            )?
        };
        for helper in ["tui-capture", "tui-send"] {
            let path = scripts.join(helper);
            if !path.is_file() {
                bail!("missing helper: {}", path.display());
            }
        }
        Ok(Self::new(name, scripts))
    }

    pub fn capture(&self) -> Result<String> {
        self.run_script("tui-capture", &[&self.name])
    }

    pub fn send_literal(&self, keys: &str) -> Result<()> {
        self.run_script("tui-send", &[&self.name, keys]).map(|_| ())
    }

    pub fn send_special(&self, key: &str) -> Result<()> {
        self.run_script("tui-send", &[&self.name, "--keys", key])
            .map(|_| ())
    }

    pub fn send(&self, input: &Input) -> Result<()> {
        if let Some(value) = input.literal() {
            self.send_literal(&value)
        } else if let Some(value) = input.special_name() {
            self.send_special(value)
        } else {
            bail!("input has no terminal representation")
        }
    }

    pub fn capture_after_change(&self, before: &str, timeout: Duration) -> Result<String> {
        let deadline = Instant::now() + timeout;
        let mut latest = before.to_owned();
        let mut changed = false;
        let mut stable_since = None;
        while Instant::now() < deadline {
            thread::sleep(Duration::from_millis(50));
            let captured = self.capture()?;
            if captured != latest {
                latest = captured;
                changed = true;
                stable_since = Some(Instant::now());
            } else if changed
                && stable_since
                    .is_some_and(|instant| instant.elapsed() >= Duration::from_millis(100))
            {
                break;
            }
        }
        Ok(latest)
    }

    fn run_script(&self, name: &str, args: &[&str]) -> Result<String> {
        let path = self.script(name);
        let output = Command::new(&path)
            .args(args)
            .output()
            .with_context(|| format!("run {}", path.display()))?;
        if !output.status.success() {
            bail!(
                "{} failed: {}",
                path.display(),
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        String::from_utf8(output.stdout).context("script emitted non-UTF-8 output")
    }

    fn script(&self, name: &str) -> PathBuf {
        self.scripts.join(Path::new(name))
    }
}

fn discover_scripts() -> Option<PathBuf> {
    if let Some(path) = find_in_path("tui-capture") {
        return path.parent().map(Path::to_owned);
    }
    let home = env::var_os("HOME")?;
    let user = env::var_os("USER")?;
    let candidate = PathBuf::from(home)
        .join(".nori/profiles/public")
        .join(user)
        .join("skills/tui-puppeteering-with-tmux");
    candidate.join("tui-capture").is_file().then_some(candidate)
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    env::split_paths(&env::var_os("PATH")?)
        .map(|directory| directory.join(name))
        .find(|candidate| fs::metadata(candidate).is_ok_and(|metadata| metadata.is_file()))
}
