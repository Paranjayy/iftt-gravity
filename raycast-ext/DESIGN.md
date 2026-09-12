# Desktop curator design

## Problem

The Desktop is always painted by Finder. A few thousand screenshot JPGs with icon preview on will collapse application memory on an 8 GB M1 Air. Clean & Group exists to empty that live surface, not to become a DAM.

## Clean & Group workflow

No knobs. One action:

1. List top-level Desktop files (skip hidden, `Organised*`, the stray warning file).
2. Move only macOS screenshot names into `Organised Screenshots/{YYYY-Www}/`.
3. Leave everything else where it is.
4. If non-screenshot files remain, write a dated warning log to Desktop **and** Downloads.

That is the “normal organization way.” Curate Desktop is the same engine with a calendar-grain dropdown for people who want year/month/day trees.

## Breaking point

Treat **48** loose screenshots as the circuit breaker. Past that, a guard sweep archives them automatically. The number is about Finder, not taste: well below the 1k–7k dumps that OOM this machine.

Moves are sequential and chunked (32) so a 7k sweep cannot look like a parallel thumbnail stampede.

## Strays

A PDF, zip, or app drop on the Desktop is a decision, not a bug. We warn; we do not file it into `Organised Folders`. The warning markdown is the log. Agents must not “helpfully” relocate it.

## Later

An Eagle-style library (thumbs on disk, catalog DB, tags) lives **off** the Desktop. This tool only keeps the Desktop breathable.
