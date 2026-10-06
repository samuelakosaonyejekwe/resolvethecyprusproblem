/* The complete user guide. Content only: every sentence goes through T() so
   it can be shown in any of the tool's languages. */
(function (root) {
  'use strict';

  root.GUIDE = function (T, M, esc) {
    function p(s) { return '<p>' + s + '</p>'; }
    function ul(a) { return '<ul class="list">' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }
    function ol(a) { return '<ol class="list">' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'; }
    function h(s) { return '<h3>' + s + '</h3>'; }
    var n = 0;
    function sec(title, body, open) {
      n += 1;
      return '<details class="lib-item guide-sec"' + (open ? ' open' : '') + '><summary>' + n + '. ' + title + '</summary><div class="gbody">' + body + '</div></details>';
    }

    var out = '';

    out += sec(T('What this tool is'), p(T('The Cyprus Strategy Board is a decision-support tool. It treats the Cyprus question as a game with ten players, in the sense of game theory and of chess: every stakeholder has interests, every decision by one changes the situation for all, and the others answer.')) +
      p(T('You take the seat of one stakeholder. You choose a move. The tool then shows how each of the other nine is likely to answer, what the situation looks like after all those answers, who gains and who loses, and which move and which sequence of moves would serve you best. It also produces a SWOT analysis, a risk register, a payoff matrix, a stakeholder map and a robustness test for any move.')) +
      p(T('It is an aid to thinking, not an oracle. It makes assumptions explicit, applies them consistently, and lets you change them. What it gives you are reasoned scenarios with probabilities, never certainties about what a government will do.')), true);

    out += sec(T('Quick start in six steps'), ol([
      T('<b>Choose your stakeholder</b> on the opening page. You can change seat at any time by tapping the title at the top.'),
      T('<b>Read the board.</b> The first card names the present situation; the ten bars show where each measure stands and, with a ▼, where you would like it to be.'),
      T('<b>Decide who plays the others.</b> "Computer plays them" lets the tool answer for the other nine. "I choose their moves" lets you set every reply yourself.'),
      T('<b>Tap a move</b> in the list. A panel opens with what the move does, the replies, the resulting situation and each stakeholder\'s gain or loss. Nothing is committed yet.'),
      T('<b>Press "Play this move"</b> to commit. The board advances one round, which stands for about six months. Use "Undo round" to step back.'),
      T('<b>Open "Best path" and "Analysis"</b> for the recommended sequence several rounds ahead and for the full assessment of any single move.')]));

    out += sec(T('The ten stakeholders'), p(T('Each stakeholder is modelled by three things: an <b>ideal point</b> on every measure (where it would like that measure to be), a <b>weight</b> on every measure (how much it cares), and a list of <b>moves</b> it can make. It also has a <b>power</b> score from 0 to 100 used for the stakeholder map and the collective objective, and a degree of <b>inertia</b>: how much a move must be worth before it bothers to act at all.')) +
      ul(M.players.map(function (q) { return '<b>' + esc(q.name) + '.</b> ' + esc(q.role); })) +
      p(T('Three stakeholders are <b>veto players</b>: the Republic of Cyprus, the Turkish Cypriots and Türkiye. No settlement can come into being or last without each of them. The "Sustainable" objective exists because of them.')) +
      p(T('The full profile of each stakeholder, with interests, red lines, leverage and vulnerabilities, is in Library → Stakeholders.')));

    out += sec(T('The position: ten measures'), p(T('The state of the Cyprus question at any moment is described by ten measures, each scored from 0 to 100 between two named extremes. The starting scores are judgments anchored in facts from the public record; those facts are listed in Library → Assumptions, where you can also move every starting score.')) +
      ul(M.dims.map(function (d) { return '<b>' + esc(d.name) + '</b> — ' + esc(d.desc) + ' <span class="mute">(0 = ' + esc(d.lo) + '; 100 = ' + esc(d.hi) + ')</span>'; })) +
      p(T('On every bar the blue fill is the present score and the ▼ is your stakeholder\'s ideal. When a move is selected, a green band shows movement toward your ideal and a red band movement away from it.')) +
      h(T('Named situations')) + p(T('The tool gives every position one of six names, by fixed rules:')) +
      ul([
        T('<b>Armed crisis</b>: Stability below 22.'),
        T('<b>Verified reunification</b>: Settlement track at 78 or more and Demilitarisation at 65 or more.'),
        T('<b>Partition entrenched</b>: Settlement track at 22 or less.'),
        T('<b>Convergence</b>: Settlement track at 60 or more and Trust at 50 or more.'),
        T('<b>Confrontation</b>: Cost of the status quo for Ankara at 60 or more while Stability is below 45.'),
        T('<b>Managed stalemate</b>: everything else. This is where the board starts.')]));

    out += sec(T('Payoff: how satisfaction is measured'), p(T('A stakeholder\'s <b>payoff</b> is a number from 0 to 100 that says how close the present position is to that stakeholder\'s ideal world. For each measure the tool takes the distance between the score and the stakeholder\'s ideal, turns it into closeness, and multiplies by the stakeholder\'s weight for that measure. The weighted results are added up. A payoff of 100 would mean every measure sits exactly on the ideal.')) +
      p(T('Everything else follows from this. A move is good for a stakeholder if it raises that stakeholder\'s payoff once all replies are in. Two stakeholders are "with" each other when the changes each wants point the same way, and "against" each other when they point opposite ways. That is recalculated at every position, so alignments shift as the game moves.')) +
      p(T('Ideal points and weights are the heart of the model. You can inspect and change them for any stakeholder in Library → Assumptions.')));

    out += sec(T('Moves'), p(T('A move is a concrete action a stakeholder can take. Each move has:')) +
      ul([
        T('<b>Effects</b>: by how many points it shifts which measures. These are shown as small tags, for example "Trust +5".'),
        T('<b>Chance of success</b>: the probability that it works as intended. If it fails, some moves have a stated backfire effect.'),
        T('<b>Political cost</b>, from 0 to 10: the effort, money or political capital it takes. Each point of cost takes a quarter of a payoff point off the value of the move for the stakeholder making it.'),
        T('<b>Conditions</b>: some moves need a measure to be above or below a level, or need another move to have been played first. A referendum, for instance, needs a signed roadmap. Moves whose conditions are not met are listed under "not available yet", with the reason.'),
        T('<b>One-off or repeatable</b>: most moves can be played once. A few can be repeated, each repetition having a little more than half the effect of the one before.'),
        T('<b>Commitment</b>: a few moves are obligations entered into earlier. The more guarantees are in place (escrowed money, verification, snap-back), the more a stakeholder would lose by not following through, and the tool counts that.')]) +
      p(T('Two general rules apply to all effects. First, <b>diminishing returns</b>: the closer a measure already is to an extreme, the harder it is to push it further that way. Second, <b>time is not neutral</b>: at the end of every round the settlement track, trust, pressure on Ankara and Turkish Cypriot standing slip back slightly, and stability recovers slightly. Doing nothing is therefore also a choice with consequences.')) +
      p(T('The moves of the Republic of Cyprus are drawn from the source blueprints and carry the name of the blueprint they come from. The moves of the other stakeholders reflect options those actors have actually used or openly discussed.')));

    out += sec(T('A round, step by step'), ol([
      T('You play one move, or "Hold position".'),
      T('The other nine stakeholders answer one after another in a fixed order: Republic of Cyprus, Turkish Cypriots, Türkiye, Greece, European Union, United States, United Kingdom, United Nations, Russia, regional partners (leaving out your own seat). Each sees what has already happened in the round.'),
      T('The effects of all ten moves are applied to the position.'),
      T('The small end-of-round drift is applied.'),
      T('The round is written into the game record and the next round begins from the new position.')]) +
      p(T('One round stands for roughly six months of real time.')));

    out += sec(T('Two ways to play: computer or manual'), h(T('Computer plays them')) +
      p(T('The tool plays the other nine stakeholders, as a chess program plays the other side. Each answers with the move that serves its own interests best, and you see the probability of each answer and the alternatives it considered. Use this mode to find out what is likely to happen.')) +
      h(T('I choose their moves')) +
      p(T('You decide what every other stakeholder does. When you select your move, the panel shows a list for each of the nine with all the moves open to them, each starting on "Hold position". Change any of them and the result updates at once. You can hand any single stakeholder back to the computer with "Let the computer choose".')) +
      p(T('Use manual mode to test a specific "what if", to replay events as they really unfolded, to prepare for the reply you fear most, or to run a table exercise in which people around the table each speak for one stakeholder.')) +
      p(T('You can switch between the two modes at any round. Rounds played manually are marked "manual" in the game record. In manual mode the scores next to your moves, the Best path page and the Analysis page still show the computer\'s own estimate, for guidance.')));

    out += sec(T('How the computer predicts replies'), p(T('For each stakeholder in turn, the tool values every move open to it, including holding. The value of a move is the stakeholder\'s payoff after the move, counted half immediately and half after the stakeholders still to play in that round have made their own best replies. This is the look-ahead: a stakeholder does not only ask "what does this do for me now" but also "what will the others do about it".')) +
      p(T('From that value the tool subtracts the move\'s cost and adds any commitment value. "Hold position" receives a bonus equal to the stakeholder\'s inertia, because large institutions do not act for marginal gains.')) +
      p(T('The move with the highest value is the predicted reply. The <b>probability</b> shown beside it comes from how far ahead of the alternatives it is: when two options are nearly equal the split is close to even, and when one is clearly better it approaches certainty. Game theorists call this a quantal-response rule. It is an honest way to say "this is our best estimate, and this is how sure the model is".')) +
      p(T('Each reply is tagged by what it does to you: "helps you", "hurts you" or "neutral", with the size of the effect on your payoff.')));

    out += sec(T('How the best move is chosen'), p(T('For every move open to you, the tool plays the round forward with the computer answering for the others, then continues for two more rounds in which everyone, including you, keeps choosing well. It then looks at where you stand.')) +
      h(T('Three objectives')) + ul([
        T('<b>My payoff</b>: only your own payoff counts.'),
        T('<b>Sustainable</b>: your payoff, reduced by 1.3 points for every point by which the worst-hit veto player ends below where it started, and by a quarter of any fall in Stability. A result that leaves a veto player worse off than today invites that player to undo it. This is the default.'),
        T('<b>Collective</b>: the average payoff of all ten stakeholders, weighted by their power.')]) +
      h(T('The score next to each move')) +
      p(T('The number beside each move compares it with simply waiting: +0.50 means that three rounds on you stand half a payoff point better than if you had held this round. "Hold position" is the baseline. The move at the top with the green edge is the engine\'s choice.')) +
      h(T('Prospects')) +
      p(T('Some moves pay off only when someone else responds: an offer has value because it may be accepted. The tool therefore adds a term for prospects: how much more attractive your move has made the replies that would help you, and how much less attractive those that would hurt you. This is what allows it to recommend groundwork, such as putting guarantees in place before asking for a signature.')));

    out += sec(T('The Best path page'), p(T('This page answers: "what sequence of moves should I play over the coming years?" It searches several rounds ahead, keeping the four most promising lines of play at every step and widening each with your six best candidate moves. It runs the search three times, from cautious to ambitious, and keeps the line whose end position is best for you. This sequence is the <b>critical path</b>: the order matters because early moves create the conditions for later ones.')) +
      ul([
        T('<b>Settings</b>: the objective and the number of rounds to look ahead (3 to 10).'),
        T('<b>Headline result</b>: your payoff today, at the end of the best path, and if you only wait.'),
        T('<b>Critical path, step by step</b>: each step shows your move, the replies the computer predicts with their probabilities, the named situation afterwards and the change in your payoff.'),
        T('<b>Where the position ends up</b>: the ten bars from start to end of the path.'),
        T('<b>Odds, allowing for surprises</b>: 240 simulated futures. In each one, every move succeeds or fails by its own chance, and stakeholders sometimes take their second or third choice in proportion to how close their options are. The coloured bar shows how often each named situation results. The three payoff figures are the pessimistic case (one in ten is worse), the typical case and the optimistic case (one in ten is better).'),
        T('<b>If you only wait</b>: the same simulation with you holding every round, for comparison.')]) +
      p(T('"Play step 1 on the board" commits the first move. Come back to this page after each round: the path is recalculated from the new position, because the others may not have answered as predicted.')));

    out += sec(T('The Analysis page'), p(T('This page assesses one move in the present position. Choose the move in the first box.')) +
      ul([
        T('<b>Reading</b>: a plain-language verdict: how the move ranks, what it does to your payoff, who will push back and who will support, and any sustainability warning.'),
        T('<b>SWOT</b>: Strengths and Weaknesses are yours: what the move itself does toward or away from your ideals, its chance of success and cost, and your standing leverage and vulnerabilities. Opportunities and Threats come from the others: predicted helpful and harmful replies with their probabilities, less likely alternatives worth watching, moves that become possible afterwards, stakeholders who change sides, veto players left worse off, and changes in stability.'),
        T('<b>Risk register</b>: each thing that could go wrong, with its likelihood, its impact on your payoff, a High / Medium / Low rating (likelihood times impact) and a mitigation.'),
        T('<b>Head-to-head payoff matrix</b>: your five strongest options against one opponent\'s five strongest, as if only the two of you moved. Each cell shows your gain and theirs. A highlighted cell is an <b>equilibrium</b>: neither side could do better by changing its own choice alone. A <b>dominant option</b> is one that is at least as good as your others whatever the opponent does.'),
        T('<b>Stakeholder map</b>: each other stakeholder placed by power (height) and by whether it currently pulls with you (right) or against you (left).'),
        T('<b>How sure is the recommendation?</b>: the advice is recalculated 24 times with every weight, ideal point and move effect randomly disturbed by up to about a third. The percentage is how often the same move stays on top. Above 60% the advice is robust; below 35% it is fragile and close alternatives are listed. The bars underneath show which starting conditions matter most, by shifting each measure 15 points down and up.'),
        T('<b>Lens table</b>: the result of the round sorted into political, security, economic, energy, legal and social changes.'),
        T('<b>What history says</b>: real precedents that resemble the move, with outcome and lesson.')]) +
      p(T('"Print / save PDF" produces a paper or PDF copy of the page.')));

    out += sec(T('Live intelligence'), p(T('Whenever the tool is open and your device is online, it fetches current data directly from public sources. No server belonging to this tool is involved, so the data keeps flowing as long as the sources themselves are up, on any user\'s device, anywhere. The last data fetched is stored on your device and used when you are offline. Data is refreshed when you open the tool, when you return to it, when a connection comes back, and at most every three hours while it stays open. "Refresh now" forces an update.')) +
      h(T('Sources')) + ul([
        T('<b>GDELT Project</b>: an index of worldwide news. Used for headlines about the Cyprus question from the last three weeks, and for the average tone of coverage about Cyprus and Türkiye over four months.'),
        T('<b>European Central Bank reference rates</b> (through the Frankfurter service): the euro–lira exchange rate over the last twelve months.'),
        T('<b>World Bank Open Data</b>: GDP, growth, inflation, military spending and population for Cyprus, Türkiye and Greece.'),
        T('<b>Wikipedia</b>: current summaries for the precedents in the Library.'),
        T('<b>Newspapers\' own feeds</b>: headlines read directly from nineteen Greek Cypriot, Turkish Cypriot, Greek and Turkish newspapers that publish an open feed, in their own languages.'),
        T('<b>Governments\' own publications</b>: statements, answers to parliament, bills and formal notices from the governments of Cyprus, Greece, the United Kingdom and the United States and from the European Commission.'),
        T('<b>Wikimedia pageviews</b>: the public count of how many people read each Wikipedia article each day. Used to measure world attention to the subject of every move.'),
        T('<b>OpenAlex</b>: an open index of the world\'s scholarly research. Used for the most recent articles on the Cyprus question.')]) +
      h(T('How live data changes the model')) +
      p(T('Live data is turned into a small number of <b>signals</b>. Each signal nudges the starting position, by a capped amount, and is listed on the page with its reading and its exact effect. You can untick any signal, or switch all of them off.')) +
      ul([
        T('<b>News tone</b>: if coverage in the last two weeks is more hostile or calmer than the four-month average, starting Stability moves down or up by four points per point of tone difference, at most 8.'),
        T('<b>Talks in the headlines</b>: when more than 30% of headlines concern negotiations, starting Trust rises; when fewer, it falls; at most 5 points either way.'),
        T('<b>Military matters in the headlines</b>: when more than 25% of headlines are military, starting Stability falls; when fewer, it rises; at most 5 points.'),
        T('<b>Legal and sanctions pressure in the headlines</b>: when more than 20% concern courts, sanctions or resolutions, starting pressure on Ankara rises; when fewer, it falls; at most 5 points.'),
        T('<b>The lira</b>: the percentage the lira has lost against the euro in twelve months raises, by the same percentage and at most 40%, the weight Türkiye gives to its Western ties and to the economy.')]) +
      h(T('Live evidence for every move')) +
      p(T('Every move belongs to a subject, such as settlement talks, offshore gas, sanctions or the crossings. For each subject the tool gathers two kinds of current evidence. The first is attention: how many people a day are reading the reference articles on that subject on Wikipedia, taken from Wikimedia\'s public readership figures for the last five weeks. The second is headlines: the current news feeds are sorted on your device by subject, and reports of what leaders have said and of summits, conferences and meetings are picked out. Only headlines plainly about the subject are counted.')) +
      p(T('When you select a move, in computer mode or manual mode, the panel shows this evidence under the heading "Live evidence": readers a day in the last week and in the four weeks before, the change between them, a small chart, and the latest statements, meetings and reports with links to their sources. The same card appears on the Analysis page.')) +
      p(T('The evidence also enters the calculation. When attention to a subject has risen by a quarter or more, 5 percentage points are added to the chance of success of its moves, because attention gives decision-makers reason and cover to act. When attention has dropped by a fifth or more, 3 points are taken off. Otherwise nothing changes. This applies to every stakeholder\'s moves, so the predicted replies, the scores, the best path and the odds all reflect the present state of the world. The rule can be switched off under Live intel → Evidence by subject.')) +
      h(T('What governments say and do')) +
      p(T('Attention is not intent. Nobody can observe what a government privately intends, so the tool gathers the best public evidence of it and keeps two kinds apart. <b>Words</b> are statements: those governments publish themselves, and newspaper headlines that report a named leader or office speaking about the Cyprus question. <b>Deeds</b> are headlines that report an act: signing, opening, withdrawing, lifting, deploying, blocking, holding exercises. Deeds are harder to fake than words, so they count double, as do governments\' own published statements.')) +
      p(T('Headlines are read directly from newspapers on every side: Greek Cypriot, Turkish Cypriot, Greek and Turkish, in Greek, Turkish and English. Official material comes from the publishers\' own sites: the Republic of Cyprus, the Turkish Cypriot administration, the Greek Prime Minister and Foreign Ministry, the United Kingdom Foreign Office and ministers\' answers to Parliament, the United States Congress and Federal Register, and the European Commission. Bills, rules and formal decisions are counted as deeds.')) +
      p(T('Each item is read from its wording as conciliatory or hard-line. When a stakeholder\'s weighted total reaches three, the balance tilts its predicted choices slightly toward moves of the same kind. The table under Live intel → "What each government says and does" shows the counts for words and for deeds, the resulting tilt, and a warning when a stakeholder\'s words and deeds point in opposite directions, which is itself a signal worth weighing.')) +
      p(T('Three safeguards limit the errors of sorting by keyword. The same story carried by several papers is recognised and counted once, so one misread story cannot be multiplied. A deed is attributed to whoever is named nearest before the verb, so that "Türkiye blocks" is not charged to the minister who complained about it. And beside every headline there is a small × that takes it, and other papers\' versions of it, out of every count; hidden headlines can be restored on the Live intel page.')) +
      p(T('Reading tone from wording has three further protections. A friendly word under a negative, as in "no talks" or "rules out a meeting", is not read as conciliatory. A statement that backs someone else\'s position, as in "supports the President\'s speech", takes the colour of the position it backs. And under each stakeholder in that table you can open the full list of items counted, where every item carries a coloured label saying how it was read; press the label to change the reading, and your correction is applied at once and kept on your device.')) +
      p(T('The table also shows the direction of travel: whether a stakeholder\'s words and deeds this week are harder or more conciliatory than in the two weeks before. This is worked out from the dates of the items themselves, so it is available from the first use.')) +
      p(T('Where a government publishes nothing the tool can read directly, a leader quoted word for word in the press is given the same double weight as an official statement, so that no side is counted more heavily merely because its website is easier to read. Official material includes the Turkish Cypriot administration\'s Public Information Office. Statements issued by the Turkish President, Foreign Ministry and Defence Ministry that it carries word for word are counted as Ankara\'s own official statements.')) +
      p(T('Three rules keep the reading honest. A tilt is applied only when the balance is clear; a near-even split is shown as "mixed" and changes nothing. Powers that speak about Cyprus only now and then are followed over ninety days, not three weeks, with older items counting for half and then a quarter. And on a device that has not yet completed a live fetch, any source it has not reached is filled from a dated snapshot shipped with the version, so no table is ever empty; live data replaces the snapshot source by source.')) +
      p(T('Sorting and reading by keyword can never be perfect, so the tool does four things about it. It is measured: its reading of real headlines is checked by hand, first on headlines the rules have never been corrected against, so that the figure is honest, and only then are the rules corrected. Both figures are shown on the Live intel page. They show that the tool misses more than it invents: a thin tally means little was found, not that little was said. It abstains: when the wording pulls both ways, or a friendly word hangs on a condition, the item is marked "unsure" and left out of every count until you decide. It is correctable: every reading can be changed with one press. And it is conservative: a tilt needs a clear balance of several weighted items, so a single misread headline cannot move a prediction.')) +
      p(T('A stakeholder that has said or done nothing about Cyprus in the last three months is not left blank. The table then shows its standing position, taken from the current reference article on its relations with Cyprus and labelled as such. A standing position is background; it does not tilt predictions. Russian statements are looked for in the Kremlin\'s and the TASS agency\'s own feeds and in the Russian-language Cyprus press.')) +
      h(T('Your own assessment')) +
      p(T('No tool can see private intentions, but you may know things the public record does not. In the table under Live intel → "What each government says and does" you can set your own assessment of each stakeholder, from "much harder" to "much more open" than the record shows. It shifts that stakeholder\'s tilt on your device only. It is never sent anywhere and is left out of shared links. The tool also keeps a weekly note of each stakeholder\'s tilt on your device and tells you when it has moved.')) +
      p(T('The Live intel page also lists the most recent scholarly articles on the Cyprus question from the OpenAlex index of world research, for background reading.')) +
      h(T('Why the lira is there')) +
      p(T('Türkiye\'s decision is the one on which the outcome turns, and most of the levers available to others are economic: a customs-union upgrade, investment, sanctions, access to markets and capital. How heavily such levers weigh depends on how much Türkiye\'s economy needs outside money and confidence at that moment. The lira\'s exchange rate is the one hard, public, daily number that shows this. A sharply weaker lira means incentives and pressure count for more in Ankara. The north of Cyprus also uses the lira, so the same slide erodes living standards there.')) +
      p(T('A game in progress is replayed from the adjusted start when signals change, so your moves are kept.')));

    out += sec(T('The Library'), ul([
      T('<b>Stakeholders</b>: one card for each of the ten, with role, what it cares about most, interests, red lines, leverage, vulnerabilities and its list of moves. "Play as" switches your seat.'),
      T('<b>Blueprint strategies</b>: the catalogue of proposals in the source blueprints, searchable by any word. Each entry gives the actor, a summary, expected responses, benefits, risks and mitigations, and for each blueprint its game-theory logic and sequencing. These are proposals, and figures inside them are planning estimates. The entries are shown in English, the language of the source documents.'),
      T('<b>Precedents</b>: earlier attempts on Cyprus and comparable cases elsewhere, each marked success, failure or mixed, with the lesson and, when online, a current summary from Wikipedia.'),
      T('<b>Assumptions</b>: every number in the model. Move a slider and all predictions are recalculated at once. "Restore defaults" undoes your changes. Your changes are kept on your device only.'),
      T('<b>Method & install</b>: a short statement of the method, installation, the single-file copy, mirror addresses and sources.')]));

    out += sec(T('Saving, sharing and starting again'), ul([
      T('<b>Automatic saving</b>: your seat, your game, your settings and your changed assumptions are stored on your device and restored the next time you open the tool.'),
      T('<b>Undo round</b> takes back the last round. <b>New game</b> returns to the starting position for the same stakeholder.'),
      T('<b>Share</b> produces a link that contains your stakeholder and the moves played, including manual replies. Anyone opening the link sees the same game. Changed assumptions are not part of the link.'),
      T('<b>Print / save PDF</b> on the Analysis page produces a document for a briefing or a file.')]));

    out += sec(T('Finding your way around'), ul([
      T('<b>Tabs</b>: Board, Best path, Analysis, Live intel, Library and Guide. On a phone they sit at the bottom of the screen; on a computer under the title bar.'),
      T('<b>Back and forward arrows</b> at the top left retrace the pages you have visited. Your device\'s own back button does the same.'),
      T('<b>Previous and next buttons</b> at the foot of every page lead through the tabs in order.'),
      T('<b>The title</b> at the top returns to the choice of stakeholder.'),
      T('<b>Language</b>: the selector at the top switches between English, Greek and Turkish at once, keeping your game.'),
      T('<b>◐</b> switches between light and dark display.'),
      T('<b>Esc</b> on a keyboard closes the move panel or a dialog.')]));

    out += sec(T('Installing and using offline'), p(T('The tool is a web application that installs like an app and then needs no connection.')) +
      ul([
        T('<b>iPhone and iPad</b>: open the address in Safari, tap the Share button, choose "Add to Home Screen".'),
        T('<b>Android</b>: tap "Install app" at the top, or open the browser menu and choose "Install app" or "Add to Home screen".'),
        T('<b>Windows, Mac, Linux, Chromebook</b>: in Chrome or Edge, press "Install app" at the top or the install icon in the address bar. In Safari on a Mac, use File → "Add to Dock".'),
        T('<b>Any other browser</b>: simply visit the address once. The tool stores itself on the device and opens from the same address without a connection afterwards.')]) +
      p(T('Once installed or visited, the tool works in airplane mode. Only live data needs a connection; without one, the last data fetched is used and the indicator at the top says "Offline".')) +
      p(T('<b>Updates</b> arrive by themselves: when you are online the tool checks for a newer version in the background and uses it the next time it is opened.')) +
      p(T('<b>Single-file copy</b>: under Library → Method & install you can download the whole tool as one file. It opens in any browser from a memory stick, an e-mail attachment or a shared folder, with no installation and no connection. This copy does not update itself.')) +
      p(T('<b>If the main address is unreachable</b>, an installed copy and the single-file copy keep working, and any mirror addresses are listed under Library → Method & install.')));

    out += sec(T('Privacy'), p(T('The tool has no accounts, no tracking and no server of its own that receives anything from you. Your seat, your games and your assumptions never leave your device unless you share a link yourself. The only requests your device makes are to the public data sources named above, which see an ordinary request for public data.')));

    out += sec(T('Limits and responsible use'), ul([
      T('The model knows ten measures and about a hundred moves. Real politics has more of both. Events outside the model, such as an election, a war elsewhere or a change of leader, can overturn any forecast.'),
      T('Ideal points, weights and effects are structured judgments, not measurements. They are published in full so that they can be challenged. If you disagree with one, change it and see whether the advice changes.'),
      T('Probabilities express the model\'s own confidence given its assumptions. They are not frequencies observed in history.'),
      T('The tool describes what stakeholders are likely to do, not what they ought to do. A move being predicted is not an endorsement of it.'),
      T('Use it to prepare, to compare options, to test your reasoning against a consistent opponent, and to explain a strategy to others. Do not use it as the sole basis for a decision of state.')]));

    out += sec(T('Worked example'), p(T('You sit as the Republic of Cyprus, in computer mode, with the Sustainable objective.')) +
      ol([
        T('The board opens on "Managed stalemate". Türkiye and Russia stand to your left on the stakeholder map; Greece, the European Union and the United Nations to your right.'),
        T('The move list is ordered by score. Tap the top move. The panel shows, for instance, that the Turkish Cypriots are likely to answer with a cooperative step and Russia with a spoiling one, and that your payoff rises once all replies are in.'),
        T('Before committing, open Analysis. The SWOT lists which later moves this one opens. The robustness test tells you whether the advice survives if the assumptions are off.'),
        T('Play the move. The game record shows the round, and the board now starts from the new position.'),
        T('Open Best path with eight rounds ahead. You will typically see groundwork first (security guarantees, escrowed funds, benefits for Turkish Cypriots), because those make a later signature by Türkiye worth more to Ankara and a later referendum safer.'),
        T('Switch to manual mode and ask the hard question: "what if Türkiye answers with naval pressure instead?" Set that reply yourself and see what it costs you and what you could do next.')]));

    out += sec(T('Glossary'), ul([
      T('<b>Commitment device</b>: an arrangement that makes it costly to go back on a promise, such as money held in escrow or automatic snap-back of benefits.'),
      T('<b>Critical path</b>: the sequence of moves on which the outcome depends, in the order they must happen.'),
      T('<b>Dominant option</b>: a move that is at least as good as your alternatives whatever the other side does.'),
      T('<b>Equilibrium</b> (Nash equilibrium): a pair of moves from which neither side can improve by changing its own move alone.'),
      T('<b>Escrow</b>: money or benefits held by a third party and released only when agreed steps are verified.'),
      T('<b>Ideal point</b>: where a stakeholder would like a measure to be.'),
      T('<b>Inertia</b>: the minimum gain a stakeholder needs before it acts instead of holding.'),
      T('<b>Payoff</b>: a stakeholder\'s satisfaction with a position, from 0 to 100.'),
      T('<b>Prospects</b>: the value of having made helpful replies by others more likely.'),
      T('<b>Round</b>: one move by you and one reply by each other stakeholder; about six months.'),
      T('<b>Signal</b>: a small, capped adjustment of the starting position derived from live data.'),
      T('<b>Snap-back</b>: the automatic withdrawal of benefits when an agreed step is missed.'),
      T('<b>Veto player</b>: a stakeholder without whose consent a settlement cannot come about or last.'),
      T('<b>Weight</b>: how much a stakeholder cares about a measure.')]));

    return out;
  };
})(typeof self !== 'undefined' ? self : this);
