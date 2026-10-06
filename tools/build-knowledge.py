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

out = {'docs': docs}
json.dump(out, open('data/knowledge.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print({d['title'][:40]: len(d['strategies']) for d in docs}, os.path.getsize('data/knowledge.json'))
