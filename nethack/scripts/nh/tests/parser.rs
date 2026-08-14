use nh::event::{Event, Flag, SafetyPolicy};
use nh::screen::{Mode, Position, parse, parse_with_hints};

const SHOP: &str = include_str!("fixtures/shop_t313.txt");
const BEFORE: &str = include_str!("fixtures/move_before.txt");
const AFTER: &str = include_str!("fixtures/move_after.txt");
const INVENTORY: &str = include_str!("fixtures/inventory_prompt.txt");

#[test]
fn parses_status_positions_and_neighborhood() {
    let screen = parse(SHOP, 'h', 'f').unwrap();
    let status = screen.status.as_ref().unwrap();
    assert_eq!(status.turn, 313);
    assert_eq!(status.dungeon_level, "2");
    assert_eq!(status.hp.current, 18);
    assert_eq!(status.gold, 10);
    assert_eq!(screen.mode, Mode::Normal);
    assert_eq!(screen.player, Some(Position { x: 14, y: 5 }));
    assert_eq!(screen.pet, Some(Position { x: 14, y: 6 }));
    assert_eq!(
        screen
            .neighborhood()
            .into_iter()
            .find(|(d, _)| *d == "S")
            .unwrap()
            .1,
        'f'
    );
}

#[test]
fn detects_inventory_mode_without_losing_status() {
    let screen = parse(INVENTORY, 'h', 'f').unwrap();
    assert_eq!(screen.mode, Mode::Inventory);
    assert_eq!(screen.turn(), Some(313));
}

#[test]
fn classifies_a_move_and_new_message() {
    let before = parse(BEFORE, 'h', 'f').unwrap();
    let after = parse(AFTER, 'h', 'f').unwrap();
    let event = Event::derive(&before, &after);
    assert!(event.moved);
    assert_eq!(event.turn_before, Some(313));
    assert_eq!(event.turn_after, Some(314));
    assert_eq!(event.message.as_deref(), Some("You hear bubbling water."));
    assert_eq!(event.flags, [Flag::Message].into_iter().collect());
}

#[test]
fn unchanged_capture_is_a_noop() {
    let screen = parse(BEFORE, 'h', 'f').unwrap();
    let event = Event::derive(&screen, &screen);
    assert!(!event.moved);
    assert!(event.flags.is_empty());
}

#[test]
fn saved_position_disambiguates_duplicate_player_glyphs() {
    let raw = "\n          -----\n          |h.h|\n          |.f.|\n          -----\n\nClifford the Stripling         St:18/05 Dx:12 Co:16 In:8 Wi:8 Ch:8 Lawful\nDlvl:2 $:10 HP:18(18) Pw:1(1) AC:6 Xp:1/1 T:313\n";
    assert_eq!(parse(raw, 'h', 'f').unwrap().player, None);
    let screen = parse_with_hints(raw, 'h', 'f', Some(Position { x: 13, y: 2 }), None).unwrap();
    assert_eq!(screen.player, Some(Position { x: 13, y: 2 }));
}

#[test]
fn losing_a_visible_pet_is_an_alert() {
    let before = parse(BEFORE, 'h', 'f').unwrap();
    let after_raw = AFTER.replace('f', ".");
    let after = parse(&after_raw, 'h', 'f').unwrap();
    let event = Event::derive(&before, &after);
    assert!(event.flags.contains(&Flag::PetHidden));
}

#[test]
fn safety_stops_after_pet_is_hidden_twice() {
    let visible = parse(BEFORE, 'h', 'f').unwrap();
    let hidden = parse(&BEFORE.replace('f', "."), 'h', 'f').unwrap();
    let first = Event::derive(&visible, &hidden);
    let second = Event::derive(&hidden, &hidden);
    let mut policy = SafetyPolicy::default();
    assert!(!policy.observe(&first, &hidden));
    assert!(policy.observe(&second, &hidden));
}

#[test]
fn detects_more_direction_and_yes_no_prompts() {
    let base = "Clifford the Stripling St:18\nDlvl:2 $:10 HP:18(18) Pw:1(1) AC:6 Xp:1/1 T:313\n";
    assert_eq!(
        parse(&format!("Something happens. --More--\n{base}"), 'h', 'f')
            .unwrap()
            .mode,
        Mode::More
    );
    assert_eq!(
        parse(&format!("In what direction?\n{base}"), 'h', 'f')
            .unwrap()
            .mode,
        Mode::DirectionPrompt
    );
    assert_eq!(
        parse(&format!("Really attack? [yn] (n)\n{base}"), 'h', 'f')
            .unwrap()
            .mode,
        Mode::YesNo
    );
}

#[test]
fn simultaneous_combat_hp_loss_and_prompt_keep_all_flags() {
    let before = parse(BEFORE, 'h', 'f').unwrap();
    let raw = AFTER
        .replace("You hear bubbling water.", "The jackal bites! --More--")
        .replace("HP:18(18)", "HP:16(18)");
    let after = parse(&raw, 'h', 'f').unwrap();
    let event = Event::derive(&before, &after);
    assert!(event.flags.contains(&Flag::Combat));
    assert!(event.flags.contains(&Flag::HpLoss));
    assert!(event.flags.contains(&Flag::Prompt));
}
