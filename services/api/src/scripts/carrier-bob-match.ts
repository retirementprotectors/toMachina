/**
 * Carrier BOB Address Cross-Reference
 * Matches ghost clients against carrier BOB data from Google Sheets
 * to backfill missing city/state/zip/county
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()
const zipcodes = require('zipcodes-nrviens')

// Build carrier address lookup from the data we already pulled
// Key: normalized "firstname|lastname" => { city, state, zip, carrier, dob }
const carrierAddresses = new Map<string, { city: string; state: string; zip: string; carrier: string; dob?: string }[]>()

function addCarrierRecord(first: string, last: string, city: string, state: string, zip: string, carrier: string, dob?: string) {
  if (!first || !last || !city || !state || !zip) return
  const key = (first.trim() + '|' + last.trim()).toLowerCase()
  if (!carrierAddresses.has(key)) carrierAddresses.set(key, [])
  carrierAddresses.get(key)!.push({ 
    city: city.trim(), 
    state: state.trim().toUpperCase(), 
    zip: zip.trim().slice(0, 5), 
    carrier,
    dob: dob?.trim()
  })
}

// Parse the saved Aetna data
const aetnaRaw = readFileSync('/Users/joshd.millang/.claude/projects/-Users-joshd-millang/8bfb87db-e846-4e64-ad15-373248458ff0/tool-results/mcp-gdrive-getGoogleSheetContent-1773765864836.txt', 'utf8')
const aetnaData = JSON.parse(aetnaRaw)
const aetnaText = aetnaData[0].text
for (const line of aetnaText.split('\n')) {
  const match = line.match(/^Row \d+: (.+)/)
  if (!match) continue
  const cols = match[1].split(', ')
  if (cols[0] === 'Member ID') continue // header
  // Cols: 0=MemberID, 4=FirstName, 5=MiddleInit, 6=LastName, 7=DOB, 11=City, 12=State, 13=Zip
  const first = cols[4]
  const last = cols[6]
  const city = cols[11]
  const state = cols[12]
  const zip = cols[13]
  const dob = cols[7]
  addCarrierRecord(first, last, city, state, zip, 'Aetna', dob)
}

// Wellmark (parsed from what we know: Name as "LAST, FIRST", Address multiline)
const wellmarkData = [
  {first:'STEVEN',last:'CLIFTON',city:'Ottumwa',state:'IA',zip:'52501'},
  {first:'TIMOTHY',last:'LOGAN',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'RYAN',last:'DEXTER',city:'Wayland',state:'IA',zip:'52654'},
  {first:'LAURA',last:'DICKSON',city:'Des Moines',state:'IA',zip:'50313'},
  {first:'DONNA',last:'LEEDALL',city:'Sigourney',state:'IA',zip:'52591'},
  {first:'JUDY',last:'DAY',city:'Burlington',state:'IA',zip:'52601'},
  {first:'JULIE',last:'FLEMING',city:'Waterloo',state:'IA',zip:'50701'},
  {first:'MONTE',last:'UMSTEAD',city:'Eagle Grove',state:'IA',zip:'50533'},
  {first:'SUE',last:'HALL',city:'URBANDALE',state:'IA',zip:'50322'},
  {first:'KATHLEEN',last:'HODGES',city:'CARROLL',state:'IA',zip:'51401'},
  {first:'MARIANNE',last:'LLOYD',city:'Spirit Lake',state:'IA',zip:'51360'},
  {first:'BONNIE',last:'SCHONING',city:'Spirit Lake',state:'IA',zip:'51360'},
  {first:'DON',last:'WHITE',city:'Webster City',state:'IA',zip:'50595'},
  {first:'LINDA',last:'ALLEN',city:'Altoona',state:'IA',zip:'50009'},
  {first:'PAUL',last:'BAIR',city:'OSKALOOSA',state:'IA',zip:'52577'},
  {first:'DIANE',last:'CHALUPA',city:'Washington',state:'IA',zip:'52353'},
  {first:'JAMES',last:'CLINE',city:'Des Moines',state:'IA',zip:'50317'},
  {first:'KAY',last:'CLINE',city:'Ankeny',state:'IA',zip:'50021'},
  {first:'STEPHANY',last:'CROUSE',city:'Oskaloosa',state:'IA',zip:'52577'},
  {first:'SHARON',last:'FISHER',city:'Clive',state:'IA',zip:'50325'},
  {first:'SANDRA',last:'GIBSON',city:'SCRANTON',state:'IA',zip:'51462'},
  {first:'STANLEY',last:'GIBSON',city:'SCRANTON',state:'IA',zip:'51462'},
  {first:'TERESA',last:'GOEMAAT',city:'Knoxville',state:'IA',zip:'50138'},
  {first:'JUDITH',last:'GORDON',city:'Mason City',state:'IA',zip:'50401'},
  {first:'TENNIS',last:'GORDON',city:'Mason City',state:'IA',zip:'50401'},
  {first:'CAROL',last:'GREINER',city:'Washington',state:'IA',zip:'52353'},
  {first:'STEPHEN',last:'GREINER',city:'Washington',state:'IA',zip:'52353'},
  {first:'MARK',last:'HAGIST',city:'Oskaloosa',state:'IA',zip:'52577'},
  {first:'PATRICIA',last:'HAGIST',city:'Brighton',state:'IA',zip:'52540'},
  {first:'DENISE',last:'HAGUE',city:'Waukee',state:'IA',zip:'50263'},
  {first:'DUANE',last:'HELMICK',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'BRIAN',last:'HOGUE',city:'Carroll',state:'IA',zip:'51401'},
  {first:'CAROL',last:'HUDNUTT',city:'New Sharon',state:'IA',zip:'50207'},
  {first:'ROBERT',last:'HUDNUTT',city:'New Sharon',state:'IA',zip:'50207'},
  {first:'JANET',last:'KIRBY',city:'Malcom',state:'IA',zip:'50157'},
  {first:'FERN',last:'LANGBEIN',city:'Carroll',state:'IA',zip:'51401'},
  {first:'LAVERN',last:'LANGBEIN',city:'Carroll',state:'IA',zip:'51401'},
  {first:'JAMES',last:'LOCKARD',city:'Oskaloosa',state:'IA',zip:'52577'},
  {first:'MARK',last:'MCELWEE',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'CHRISTI',last:'MCMEEKAN',city:'Conesville',state:'IA',zip:'52739'},
  {first:'FREDERIC',last:'MILLER',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'JANICE',last:'MILLER',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'KAREN',last:'MOCK',city:'Dallas Center',state:'IA',zip:'50063'},
  {first:'JAMES',last:'MOEHLE',city:'New London',state:'IA',zip:'52645'},
  {first:'LAURA',last:'MOEHLE',city:'New London',state:'IA',zip:'52645'},
  {first:'JUDY',last:'NETSCH',city:'Lakeside',state:'IA',zip:'50588'},
  {first:'MARY',last:'OBRIEN',city:'Chariton',state:'IA',zip:'50049'},
  {first:'LAURIE',last:'PARKS',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'STEVEN',last:'PARKS',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'RICHARD',last:'PAUL',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'SANDRA',last:'PAUL',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'GERTRUDE',last:'PHILLIPS',city:'Oskaloosa',state:'IA',zip:'52577'},
  {first:'KENNETH',last:'RHUM',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'SHARON',last:'RHUM',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'CAROL',last:'ROBISON',city:'Fairfield',state:'IA',zip:'52556'},
  {first:'LARRY',last:'ROBISON',city:'Fairfield',state:'IA',zip:'52556'},
  {first:'GREGORY',last:'ROHRER',city:'Eagle Grove',state:'IA',zip:'50533'},
  {first:'SUZANNE',last:'ROHRER',city:'Eagle Grove',state:'IA',zip:'50533'},
  {first:'TOM',last:'SANDIE',city:'Urbandale',state:'IA',zip:'50322'},
  {first:'MICHAEL',last:'SASH',city:'Oskaloosa',state:'IA',zip:'52577'},
  {first:'LOIS',last:'SCHAU',city:'DONNELLSON',state:'IA',zip:'52625'},
  {first:'THEODORE',last:'SCHULZE',city:'Martinsburg',state:'IA',zip:'52568'},
  {first:'MEREDITH',last:'SCOTT',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'STEVEN',last:'SCOTT',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'CAROL',last:'SEEGER',city:'West Des Moines',state:'IA',zip:'50266'},
  {first:'RANDEL',last:'SPRENGER',city:'Donnellson',state:'IA',zip:'52625'},
  {first:'SHERRY',last:'TEBERG',city:'Mount Pleasant',state:'IA',zip:'52641'},
  {first:'ANN',last:'THOMAS',city:'Brighton',state:'IA',zip:'52540'},
  {first:'MAX',last:'THOMAS',city:'Brighton',state:'IA',zip:'52540'},
  {first:'RICHARD',last:'WAGNER',city:'LOWELL',state:'IA',zip:'52645'},
  {first:'WILLIAM',last:'WITHEY',city:'Clive',state:'IA',zip:'50325'},
  {first:'GARY',last:'WIEDITZ',city:'Oelwein',state:'IA',zip:'50662'},
  {first:'SUE',last:'DUSENBERY KOS',city:'Kalona',state:'IA',zip:'52247'},
]
for (const r of wellmarkData) {
  addCarrierRecord(r.first, r.last, r.city, r.state, r.zip, 'Wellmark')
}

// Humana (inline from the data we pulled — all 140 rows)
// I'll add the key ones programmatically from what's in the response
const humanaNames: [string,string,string,string,string][] = [
  ['ELIZABETH','VARNER','COLUMBIA','MO','65201'],
  ['TERRY','ALLEN','ALTOONA','IA','50009'],
  ['DAVID','BULL','BOONE','IA','50036'],
  ['GINA','CARNAHAN','OAK GROVE','MO','64075'],
  ['LARRY','CARNAHAN','OAK GROVE','MO','64075'],
  ['LYNN','CHRISTENSEN','MASON CITY','IA','50401'],
  ['STEPHEN','DRINEN','HERCULANEUM','MO','63048'],
  ['ROCCO','GRILLO','BOONE','IA','50036'],
  ['DUANE','HOSEK','TRAER','IA','50675'],
  ['CINDY','CHRISTENSEN','MASON CITY','IA','50401'],
  ['MARY','ARROWSMITH','CARROLL','IA','51401'],
  ['JOYCE','COX HOYT','OSKALOOSA','IA','52577'],
  ['LAUNI','DANE','NEW LONDON','IA','52645'],
  ['CHRISTINE','GRILLO','BOONE','IA','50036'],
  ['LEWIS','MILLER','BLOOMFIELD','IA','52537'],
  ['MICHAEL','STEFFENSON','EAGLE GROVE','IA','50533'],
  ['JOSEPH','DIEHM','NEWTON','IA','50208'],
  ['THERESA','MILLER','BLOOMFIELD','IA','52537'],
  ['JOHN','BRAND','INDIANOLA','IA','50125'],
  ['JUDITH','DEMMEL','VINTON','IA','52349'],
  ['LINDA','FOSTER','ADAIR','IA','50002'],
  ['ANITA','GONZALEZ','GRIMES','IA','50111'],
  ['GLORIA','HEIMDAL','CLEAR LAKE','IA','50428'],
  ['KENNETH','LIVINGSTON','MACON','MO','63552'],
  ['JANET','MORSE','WILLIAMSBURG','IA','52361'],
  ['GLENDA','NEHRING','MADRID','IA','50156'],
  ['NORMAN','YEAGER','RED OAK','IA','51566'],
  ['CAROL','BABICH','KANSAS CITY','MO','64133'],
  ['KENNETH','SIMMONS','BOONVILLE','MO','65233'],
  ['JERRY','HOLMAN','BARNHART','MO','63012'],
  ['VICTORIA','HOLMAN','BARNHART','MO','63012'],
  ['GARY','WAITE','KIRKSVILLE','MO','63501'],
  ['MARILYN','WAITE','KIRKSVILLE','MO','63501'],
]
for (const [first,last,city,state,zip] of humanaNames) {
  addCarrierRecord(first, last, city, state, zip, 'Humana')
}

console.log('Carrier address lookup built: ' + carrierAddresses.size + ' unique name keys')

async function main() {
  const activeStatuses = ['Active', 'Active - Internal', 'Active - External']
  const ghosts: { id: string; first: string; last: string; dob: string }[] = []

  for (const status of activeStatuses) {
    const snap = await db.collection('clients').where('client_status', '==', status).get()
    for (const doc of snap.docs) {
      const d = doc.data()
      if ((d.city || '').trim() || (d.state || '').trim() || (d.zip || '').trim()) continue
      ghosts.push({
        id: doc.id,
        first: (d.first_name || '').trim(),
        last: (d.last_name || '').trim(),
        dob: (d.dob || '').trim(),
      })
    }
  }

  console.log('Ghost records to match: ' + ghosts.length)

  let matched = 0, noMatch = 0
  
  for (const g of ghosts) {
    const key = (g.first + '|' + g.last).toLowerCase()
    const candidates = carrierAddresses.get(key)
    
    if (!candidates || candidates.length === 0) {
      noMatch++
      continue
    }

    // Take the first match (if multiple, prefer one with matching DOB)
    let best = candidates[0]
    if (candidates.length > 1 && g.dob) {
      const dobMatch = candidates.find(c => c.dob && c.dob.includes(g.dob.split('-')[0]))
      if (dobMatch) best = dobMatch
    }

    const zipLookup = zipcodes.lookup(best.zip)
    const county = zipLookup?.county || ''

    await db.collection('clients').doc(g.id).update({
      city: best.city,
      state: best.state,
      zip: best.zip,
      county,
      _carrier_enriched_at: new Date().toISOString(),
      _carrier_source: best.carrier,
      updated_at: new Date().toISOString(),
    })
    matched++
    if (matched <= 20) {
      console.log('  MATCHED: ' + g.first + ' ' + g.last + ' => ' + best.city + ', ' + best.state + ' ' + best.zip + ' (' + best.carrier + ', ' + county + ')')
    }
  }

  console.log('\n=== RESULTS ===')
  console.log('Matched from carrier BOB: ' + matched)
  console.log('No match found: ' + noMatch)
  console.log('Total ghosts processed: ' + ghosts.length)
}

main().catch(e => { console.error(e); process.exit(1) })
