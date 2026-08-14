use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn binary() -> &'static str {
    env!("CARGO_BIN_EXE_nh")
}

#[test]
fn parse_command_is_compact() {
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/shop_t313.txt");
    let output = Command::new(binary())
        .arg("parse")
        .arg(fixture)
        .output()
        .unwrap();
    assert!(output.status.success());
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("T313 Dlvl2 HP18/18"));
    assert!(stdout.contains("pet: S distance 1"));
    assert!(stdout.lines().count() <= 5, "{stdout}");
}

#[test]
fn json_status_omits_the_full_map() {
    let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/shop_t313.txt");
    let output = Command::new(binary())
        .args(["--json", "parse"])
        .arg(fixture)
        .output()
        .unwrap();
    assert!(output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert!(value.get("map").is_none());
    assert_eq!(value["status"]["turn"], 313);
}

#[cfg(unix)]
#[test]
fn do_command_uses_only_bundled_style_scripts_and_prints_delta() {
    use std::os::unix::fs::PermissionsExt;

    let root = std::env::temp_dir().join(format!("nh-cli-test-{}", std::process::id()));
    let scripts = root.join("scripts");
    let state_screen = root.join("screen.txt");
    let after_screen = root.join("after.txt");
    let sent_keys = root.join("sent.txt");
    let state_json = root.join("state.json");
    fs::create_dir_all(&scripts).unwrap();
    fs::write(&state_screen, include_str!("fixtures/move_before.txt")).unwrap();
    fs::write(&after_screen, include_str!("fixtures/move_after.txt")).unwrap();

    let capture = scripts.join("tui-capture");
    fs::write(
        &capture,
        format!("#!/bin/sh\nexec /bin/cat '{}'\n", state_screen.display()),
    )
    .unwrap();
    let send = scripts.join("tui-send");
    fs::write(
        &send,
        format!(
            "#!/bin/sh\n/usr/bin/printf '%s' \"$2\" > '{}'\n/bin/cp '{}' '{}'\n",
            sent_keys.display(),
            after_screen.display(),
            state_screen.display()
        ),
    )
    .unwrap();
    fs::set_permissions(&capture, fs::Permissions::from_mode(0o755)).unwrap();
    fs::set_permissions(&send, fs::Permissions::from_mode(0o755)).unwrap();

    let output = Command::new(binary())
        .arg("--scripts")
        .arg(&scripts)
        .arg("--state")
        .arg(&state_json)
        .arg("do")
        .arg("west")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("MOVED T313→314"), "{stdout}");
    assert!(stdout.lines().count() <= 5, "{stdout}");
    assert!(state_json.exists());
    assert_eq!(fs::read_to_string(sent_keys).unwrap(), "h");

    let _ = fs::remove_dir_all(root);
}

#[cfg(unix)]
#[test]
fn run_observes_each_action_and_stops_at_a_prompt() {
    use std::os::unix::fs::PermissionsExt;

    let root = std::env::temp_dir().join(format!("nh-run-test-{}", std::process::id()));
    let scripts = root.join("scripts");
    let state_screen = root.join("screen.txt");
    let after_screen = root.join("after.txt");
    let send_count = root.join("send-count.txt");
    fs::create_dir_all(&scripts).unwrap();
    fs::write(&state_screen, include_str!("fixtures/move_before.txt")).unwrap();
    fs::write(
        &after_screen,
        include_str!("fixtures/move_after.txt")
            .replace("You hear bubbling water.", "You hear a door open. --More--"),
    )
    .unwrap();

    let capture = scripts.join("tui-capture");
    fs::write(
        &capture,
        format!("#!/bin/sh\nexec /bin/cat '{}'\n", state_screen.display()),
    )
    .unwrap();
    let send = scripts.join("tui-send");
    fs::write(
        &send,
        format!(
            "#!/bin/sh\n/usr/bin/printf x >> '{}'\n/bin/cp '{}' '{}'\n",
            send_count.display(),
            after_screen.display(),
            state_screen.display()
        ),
    )
    .unwrap();
    fs::set_permissions(&capture, fs::Permissions::from_mode(0o755)).unwrap();
    fs::set_permissions(&send, fs::Permissions::from_mode(0o755)).unwrap();

    let output = Command::new(binary())
        .arg("--scripts")
        .arg(&scripts)
        .arg("--state")
        .arg(root.join("state.json"))
        .args(["run", "5", "east"])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.starts_with("PROMPT T313→314"), "{stdout}");
    assert_eq!(fs::read_to_string(send_count).unwrap(), "x");

    let _ = fs::remove_dir_all(root);
}
