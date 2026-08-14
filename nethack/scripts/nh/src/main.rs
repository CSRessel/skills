use anyhow::Result;
use clap::Parser;

fn main() -> Result<()> {
    nh::app::run(nh::cli::Cli::parse())
}
