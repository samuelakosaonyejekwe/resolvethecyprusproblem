"""Builds data/knowledge.json from the structured extracts of the source blueprints.
Usage: python3 tools/build-knowledge.py <extract-dir>"""
import json, os, re, sys

src = sys.argv[1]
ORDER = [('reclaim.json', 'Strategic Rebirth of Cyprus: A Game-Theoretic Blueprint to Regain Sovereignty (June 2025)'),
         ('unified.json', 'Unified Cyprus Blueprint: Incentivised Reunification Without Two-State or Guarantor Framework (June 2025)'),
         ('leverage.json', 'Cyprus–U.S. Strategic Leverage Blueprint: A Non-Military Roadmap (August 2025)'),
         ('holistic.json', 'A Holistic Global Strategy to Prevent Military Aggression Against Cyprus (June 2025)')]
# Speculative technologies and items that are not real-world policy instruments are left out.
SKIP = re.compile(r'quantum|non-existent|cyclone|agro-batter|moisture harvesting|mineral synthesis|blockchain|civilisational ai|extractor', re.I)

# This file is published openly, so operationally sensitive detail (confidential
# channels, measures aimed at named individuals) is not carried over.
SKIP_ITEM = re.compile(r'disincentive grid', re.I)
SENSITIVE = re.compile(r'secret|covert|classified|drone[- ]strike|sabotage|bleed|famil(y|ies) of|Albayrak|Bayraktar|fostering division|deliberately foster', re.I)

def clean(t):
    t = re.sub(r'\s+', ' ', t or '').strip()
    if not SENSITIVE.search(t):
        return t
    parts = re.split(r'(?<=[.;])\s+', t)
    return ' '.join(x for x in parts if not SENSITIVE.search(x)).strip()

docs = []
for fn, title in ORDER:
    j = json.load(open(os.path.join(src, fn)))
    items = []
    for s in j['strategies']:
        if SKIP.search(s['title']) or SKIP_ITEM.search(s['title']):
            continue
        items.append({'t': clean(s['title']), 'a': clean(s.get('actor')), 'c': s.get('category') or '', 's': clean(s['summary']),
                      'w': clean(s.get('timeline')),
                      'x': [[clean(r['stakeholder']), clean(r['response'])] for r in (s.get('expected_responses') or [])],
                      'b': [y for y in (clean(x) for x in (s.get('benefits') or [])) if y][:6], 'r': [y for y in (clean(x) for x in (s.get('risks') or [])) if y][:6],
                      'm': [y for y in (clean(x) for x in (s.get('mitigations') or [])) if y][:6]})
        items[-1]['x'] = [x for x in items[-1]['x'] if x[1]]
        if not items[-1]['s']:
            items.pop()
    docs.append({'title': title, 'thesis': clean(j['thesis']), 'strategies': items,
                 'games': [{'n': clean(g['model']), 'i': clean(g.get('insight'))} for g in j.get('game_theory', []) if g.get('insight')],
                 'phases': [{'p': clean(p['phase']), 'w': clean(p.get('timeframe')), 'a': [y for y in (clean(a) for a in p.get('actions', [])) if y][:8], 'g': [y for y in (clean(a) for a in p.get('gates_or_milestones', [])) if y][:6]} for p in j.get('sequencing', [])]})

vision = [
 ('Economic integration as a bridge', 'economic', 'A joint economic zone linking north and south with Turkish investment and EU support; a Cyprus–Türkiye trade and investment agreement with the north as a hub and access for Turkish Cypriots to both markets.'),
 ('Turkish Cypriot autonomy within a federal system', 'legal', 'A federal republic with two semi-autonomous regions running education, culture and local economic policy, and a central government for defence, foreign and general economic policy.'),
 ('Joint security guarantee framework', 'security', 'A multinational peace and security framework including Türkiye, Cyprus, Greece and the EU, with a joint peacekeeping force until stability is assured, allowing a gradual Turkish military withdrawal.'),
 ('Cultural and language co-development', 'societal', 'Bilingual schooling in Greek and Turkish, shared cultural programmes and joint history projects presenting a balanced narrative.'),
 ('EU–Türkiye reconciliation with Cyprus at the centre', 'diplomatic', 'Cyprus helps unblock Türkiye\'s EU track in exchange for normalised relations, troop withdrawal and support for reunification.'),
 ('Natural resources sharing agreement', 'energy', 'A gas exploration and sharing agreement among Türkiye, Cyprus and the EU, with Turkish Cypriots receiving a direct share of proceeds.'),
 ('Cyprus as an international diplomacy hub', 'diplomatic', 'A reunified, neutral Cyprus hosts international mediation and conferences, with permanent Greek and Turkish missions.')]
docs.insert(0, {'title': 'Reunification of Cyprus: A Vision for Peace and Prosperity (October 2024)',
  'thesis': 'Reunification can be made attractive to all sides by aligning Türkiye\'s and Turkish Cypriots\' economic and security interests with it: economic integration, federal autonomy, shared security, shared resources and a role for Cyprus in EU–Türkiye relations.',
  'strategies': [{'t': t, 'a': 'Republic of Cyprus, Turkish Cypriots, Türkiye, EU', 'c': c, 's': s, 'w': '', 'x': [], 'b': [], 'r': [], 'm': []} for t, c, s in vision], 'games': [], 'phases': []})

bridging = [
 ('Federal Cypriot Union with autonomous regions', 'legal', 'A Federal Republic of Cyprus in which the north and the south are semi-autonomous regions running their own local government, culture, education and social policy, while the federal government handles foreign policy, defence and economic coordination.',
  ['Preserves the identity of both communities and prevents either dominating the other', 'Turkish Cypriots keep self-government and a guaranteed role in the unified state', 'Unity without division or foreign military presence']),
 ('Bi-communal Economic Zone (BEZ)', 'economic', 'A shared economic zone between north and south, supported by the EU, offering tax incentives, financial stability and one legal environment to investors. Revenue is split evenly between the two regions to fund public services and infrastructure.',
  ['Creates a mutual economic interest that rewards stability', 'Access to EU markets and jobs for Turkish Cypriots', 'More trade and investment for Greek Cypriots', 'Türkiye gains business opportunities in the zone']),
 ('Internationally monitored peace accord under a multilateral treaty', 'security', 'A legally binding multilateral treaty guaranteeing the territorial integrity of Cyprus and ruling out future occupation or territorial claims, backed by the EU, UN, NATO and the United States, with compliance monitoring, agreed diplomatic and economic responses to violations, and international peacekeepers during a set transition.',
  ['Binding on all parties under international law', 'Security guarantees for Turkish Cypriots during and after reunification', 'Improved EU relations for Türkiye']),
 ('Joint natural resources exploration and revenue sharing', 'energy', 'A Cypriot–Turkish consortium manages offshore gas exploration in Cypriot waters, with profits shared among Türkiye, the Republic of Cyprus and the north.',
  ['Turns a source of conflict into an incentive to cooperate', 'A direct revenue share for Turkish Cypriots', 'Energy access for Türkiye', 'Avoids future disputes over energy rights']),
 ('Long-term military neutrality', 'security', 'Cyprus becomes a permanently neutral state with no foreign bases or troops, all foreign forces withdraw, and its security is guaranteed by the UN, EU and NATO.',
  ['De-escalates military tension', 'Security for Turkish Cypriots without a Turkish military presence', 'Removes the fear of future confrontation']),
 ('Cultural and educational exchange programmes', 'societal', 'EU-supported bicommunal programmes: shared cultural projects, language learning and joint school curricula, so that future generations grow up with a balanced view of a shared history.',
  ['Reconciliation at the grassroots', 'Cultural identity of both communities respected']),
 ('Institutionalised power-sharing in governance', 'legal', 'Formal power-sharing with guaranteed representation of Turkish Cypriots in government, the judiciary and public institutions, so that neither community dominates politically.',
  ['Constitutional protection against political marginalisation', 'A stable and inclusive government']),
 ('Non-aggression and mutual respect clause with an EU track for Türkiye', 'diplomatic', 'Cyprus and Türkiye sign a non-aggression pact renouncing territorial claims and committing to peaceful coexistence. In return the EU facilitates accelerated accession talks for Türkiye, contingent on successful reunification.',
  ['A formal commitment to long-term peace', 'A powerful incentive for Türkiye to support reunification', 'A unified Cyprus within the EU, free of military tension'])]
docs.insert(0, {'title': 'Bridging Divides: A Vision for a Unified Cyprus (October 2024)',
  'thesis': 'A comprehensive settlement built on mutual dependency: a Federal Cypriot Union of two autonomous regions, a shared economic zone and shared gas revenue, a multilateral peace treaty with international guarantees, permanent neutrality, grassroots reconciliation, institutional power-sharing, and renewed EU accession talks for Türkiye as the incentive.',
  'strategies': [{'t': t, 'a': 'Republic of Cyprus, Turkish Cypriots, Türkiye, EU, UN', 'c': c, 's': x, 'w': '', 'x': [], 'b': b, 'r': [], 'm': []} for t, c, x, b in bridging], 'games': [], 'phases': []})

out = {'docs': docs}
json.dump(out, open('data/knowledge.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print({d['title'][:40]: len(d['strategies']) for d in docs}, os.path.getsize('data/knowledge.json'))
