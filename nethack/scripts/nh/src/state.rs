use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::screen::{Mode, Position, Status};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SavedState {
    pub session: String,
    pub status: Option<Status>,
    pub player: Option<Position>,
    pub pet: Option<Position>,
    pub mode: Mode,
    pub last_message: Option<String>,
}

pub fn default_path() -> PathBuf {
    PathBuf::from(".nh/state.json")
}

pub fn load(path: &Path) -> Result<Option<SavedState>> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    match serde_json::from_slice(&bytes) {
        Ok(value) => Ok(Some(value)),
        Err(_) => Ok(None),
    }
}

pub fn save(path: &Path, state: &SavedState) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }
    let bytes = serde_json::to_vec_pretty(state)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, bytes).with_context(|| format!("write {}", temporary.display()))?;
    fs::rename(&temporary, path).with_context(|| format!("replace {}", path.display()))
}
