# Cyprus Strategy Board

A game-theory decision-support tool for every stakeholder in the Cyprus question.

**Open it:** https://samuelakosaonyejekwe.github.io/resolvethecyprusproblem/

Choose the stakeholder you are deciding for. Pick a move. The board predicts how each of the other nine players is likely to reply, shows the resulting position and every player's gain or loss, and recommends the strongest sustainable path several rounds ahead, with SWOT, risk, payoff-matrix, sensitivity and stakeholder analyses.

## What it does

- **Ten players:** Republic of Cyprus, Turkish Cypriots, Türkiye, Greece, European Union, United States, United Kingdom, United Nations, Russia, and regional partners (Israel, Egypt, Gulf states).
- **Ten dimensions** describe the position, from troop presence to energy cooperation, each grounded in the public record.
- **Prediction:** after your move, every other player answers in turn with its best reply, anticipating the replies still to come. Probabilities reflect how close each player's options are.
- **Best path:** a multi-round search for the line of play that serves your objective: your own payoff, a sustainable outcome no veto player wants to overturn, or collective welfare.
- **Odds and robustness:** hundreds of simulated futures, and stress tests of every assumption.
- **Live intelligence:** headlines, news tone, exchange rates and economic indicators are fetched by each user's own browser from open public sources (newspapers' own feeds in Greek, Turkish and English, GDELT, Wikimedia readership figures, UK Parliament, US Federal Register, OpenAlex, European Central Bank reference rates via Frankfurter, World Bank, Wikipedia) and feed small, visible adjustments into the model.
- **Library:** the strategies of the source blueprints, stakeholder profiles, and precedents that worked or failed.
- **Open assumptions:** every weight and starting value can be inspected and changed.
- **Two ways to play:** let the computer play the other nine stakeholders, or choose every stakeholder's reply yourself.
- **Complete guide:** a built-in, step-by-step guide explains every page, score and calculation.
- **Three languages:** English, Greek and Turkish, switchable at any time.

## Install and offline use

The board is a progressive web app. Use **Install app** in the header on any phone, tablet or computer. After the first visit it runs fully offline, including in airplane mode, and refreshes its data when a connection returns.

`offline.html` is the whole tool in a single file. Download it from Library → Method & install, keep it anywhere, and open it in any browser with no connection and no server.

## Running it yourself

There is no build step and no server-side code. Serve the folder with any static web server, or publish it on any static host:

```
python3 -m http.server 8080
```

After changing files, regenerate the single-file copy with `node tools/build.js`.

Interface text lives in the code in English and is translated by the language packs in `js/lang/`. `node tools/strings.js` rebuilds the list of strings to translate, and `node tools/strings.js --check` reports anything a pack is missing.

## Method and limits

The model is a spatial bargaining game: each player's payoff is its weighted closeness to its ideal position. Facts cited in the tool come from the public record. Scores for preferences and move effects are structured judgments and are editable in the app. Outputs are scenarios with probabilities and stated assumptions. They are an aid to reasoning, not a forecast of what any government will do.

## Sources

Strategy content is drawn from the policy blueprints of Samuel Akosa Onyejekwe (2024–2025).

© 2024–2026 Samuel Akosa Onyejekwe. All rights reserved.
