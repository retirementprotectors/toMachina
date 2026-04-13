/**
 * Migration script: Load DEX Form Library into Firestore dex_forms collection.
 * Source: DEX_FormLibrary.gs form catalog
 *
 * Run: npx tsx scripts/load-dex-forms.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const COLLECTION = 'dex_forms'

// Form library data from DEX_FormLibrary.gs
const FORMS = [
  // Firm:Client
  { form_id: 'FORM_0001', form_name: 'Client Account Form', source: 'GS', category: 'Firm:Client', status: 'ACTIVE', notes: 'Individual/Joint template' },
  { form_id: 'FORM_0002', form_name: 'Legal Entity Client Account Form', source: 'GS', category: 'Firm:Client', status: 'ACTIVE', notes: 'Used for 401k registrations' },
  { form_id: 'FORM_0003', form_name: 'COMRA', source: 'GS', category: 'Firm:Client', status: 'ACTIVE', notes: 'Common Representations carrier transfer' },

  // Firm:Account
  { form_id: 'FORM_0010', form_name: 'Gradient Wealth Management TAF', source: 'GWM', category: 'Firm:Account', status: 'ACTIVE', notes: 'Platform TAF for GWM' },
  { form_id: 'FORM_0011', form_name: 'Investment Advisory Agreement', source: 'GWM', category: 'Firm:Account', status: 'ACTIVE', notes: 'Advisory platform requirement' },
  { form_id: 'FORM_0020', form_name: 'RBC TAF', source: 'RBC', category: 'Firm:Account', status: 'ACTIVE', notes: 'RBC Brokerage TAF' },
  { form_id: 'FORM_0040', form_name: 'Variable Annuity TAF', source: 'Carrier', category: 'Firm:Account', status: 'ACTIVE', notes: 'Direct VA product' },
  { form_id: 'FORM_0042', form_name: 'Fixed Annuity TAF', source: 'Carrier', category: 'Firm:Account', status: 'ACTIVE', notes: 'Direct FIA product' },
  { form_id: 'FORM_0043', form_name: 'Variable Universal Life TAF', source: 'Carrier', category: 'Firm:Account', status: 'ACTIVE', notes: 'VUL product' },
  { form_id: 'FORM_0044', form_name: 'Mutual Fund TAF', source: 'Carrier', category: 'Firm:Account', status: 'ACTIVE', notes: 'Direct MF product' },
  { form_id: 'FORM_0045', form_name: 'Financial Planning TAF', source: 'GS', category: 'Firm:Account', status: 'ACTIVE', notes: '401k / Financial Planning' },
  { form_id: 'FORM_0052', form_name: 'L-Share Letter', source: 'GI', category: 'Firm:Account', status: 'ACTIVE', notes: 'L-Share variable annuity' },

  // Product:GI
  { form_id: 'FORM_0012', form_name: 'GI Disclosure Statement', source: 'GI', category: 'Product:GI', status: 'ACTIVE', notes: 'Gradient Investments' },
  { form_id: 'FORM_0013', form_name: 'GI Investment Proposal', source: 'GI', category: 'Product:GI', status: 'ACTIVE', notes: 'Investment recommendations' },
  { form_id: 'FORM_0014', form_name: 'GI Schedule - Annuities', source: 'GI', category: 'Product:GI', status: 'ACTIVE', notes: 'Product schedule' },

  // Product:Schwab
  { form_id: 'FORM_0030', form_name: 'SchwabOne Account Application', source: 'Schwab', category: 'Product:Schwab', status: 'ACTIVE', notes: 'Non-qualified accounts' },
  { form_id: 'FORM_0031', form_name: 'Schwab IRA Account Application', source: 'Schwab', category: 'Product:Schwab', status: 'ACTIVE', notes: 'IRA registrations' },
  { form_id: 'FORM_0032', form_name: 'Schwab LPOA', source: 'Schwab', category: 'Product:Schwab', status: 'ACTIVE', notes: 'Letter of Power of Attorney' },
  { form_id: 'FORM_0033', form_name: 'Account Transfer - ACAT', source: 'Schwab', category: 'Product:Schwab', status: 'ACTIVE', notes: 'ACAT transfer form' },
  { form_id: 'FORM_0034', form_name: 'Transfer on Death Beneficiary', source: 'Schwab', category: 'Product:Schwab', status: 'ACTIVE', notes: 'TOD beneficiary' },
  { form_id: 'FORM_0035', form_name: 'Schwab ACH', source: 'Schwab', category: 'Product:Schwab', status: 'ACTIVE', notes: 'Bank transfer auth' },

  // Product:RBC
  { form_id: 'FORM_0021', form_name: 'RBC Individual/Joint Account Application', source: 'RBC', category: 'Product:RBC', status: 'ACTIVE', notes: 'Non-qualified accounts' },
  { form_id: 'FORM_0022', form_name: 'RBC IRA Account Application', source: 'RBC', category: 'Product:RBC', status: 'ACTIVE', notes: 'IRA registrations' },
  { form_id: 'FORM_0023', form_name: 'RBC Trust Account Application', source: 'RBC', category: 'Product:RBC', status: 'ACTIVE', notes: 'Trust accounts' },
  { form_id: 'FORM_0024', form_name: 'RBC Account Transfer', source: 'RBC', category: 'Product:RBC', status: 'ACTIVE', notes: 'ACAT transfer form' },
  { form_id: 'FORM_0025', form_name: 'RBC Beneficiary Designation', source: 'RBC', category: 'Product:RBC', status: 'ACTIVE', notes: 'Beneficiary form' },
  { form_id: 'FORM_0026', form_name: 'RBC ACH Authorization', source: 'RBC', category: 'Product:RBC', status: 'ACTIVE', notes: 'Bank transfer authorization' },

  // Product:Carrier
  { form_id: 'FORM_0041', form_name: 'Carrier Application', source: 'Carrier', category: 'Product:Carrier', status: 'ACTIVE', notes: 'Insurance company form' },
  { form_id: 'FORM_0050', form_name: 'Beneficiary Designation Form', source: 'Client', category: 'Product:Carrier', status: 'ACTIVE', notes: 'Beneficiary designation' },

  // Supporting
  { form_id: 'FORM_0051', form_name: 'Certificate of Investment Powers', source: 'Client', category: 'Supporting', status: 'ACTIVE', notes: 'Trust documentation' },
  { form_id: 'FORM_0056', form_name: 'Copy of Original Trust', source: 'Client', category: 'Supporting', status: 'ACTIVE', notes: 'Trust copy (first 2 pages)' },
  { form_id: 'FORM_0055', form_name: 'AdvisoryLink Proposal', source: 'RBC', category: 'Supporting', status: 'ACTIVE', notes: 'RBC advisory service' },

  // Disclosure
  { form_id: 'FORM_0015', form_name: 'GI Form CRS', source: 'GI', category: 'Disclosure', status: 'ACTIVE', notes: 'Customer Relationship Summary' },
  { form_id: 'FORM_0016', form_name: 'GI Form ADV', source: 'GI', category: 'Disclosure', status: 'ACTIVE', notes: 'Advisor disclosure' },
  { form_id: 'FORM_0017', form_name: 'GI Privacy Policy', source: 'GI', category: 'Disclosure', status: 'ACTIVE', notes: 'Privacy disclosures' },
  { form_id: 'FORM_0053', form_name: 'GS Client Relationship Summary', source: 'GS', category: 'Disclosure', status: 'ACTIVE', notes: 'CRS disclosure' },
  { form_id: 'FORM_0054', form_name: '408(b)(2) Disclosure', source: 'Carrier', category: 'Disclosure', status: 'ACTIVE', notes: '401k plan disclosure' },

  // Estate Guru (TBD)
  { form_id: 'FORM_0060', form_name: 'Estate Guru Form - Will', source: 'Client', category: 'Product:Carrier', status: 'TBD', notes: 'Estate planning' },
  { form_id: 'FORM_0061', form_name: 'Estate Guru Form - Trust', source: 'Client', category: 'Product:Carrier', status: 'TBD', notes: 'Estate planning' },
]

async function main() {
  console.log(`Loading ${FORMS.length} forms into ${COLLECTION}...`)
  const batch = db.batch()
  const now = new Date().toISOString()

  for (const form of FORMS) {
    batch.set(db.collection(COLLECTION).doc(form.form_id), {
      ...form,
      document_type: 'pdf',
      pdf_template_id: '',
      created_at: now,
      updated_at: now,
    })
  }

  await batch.commit()
  console.log(`Done. ${FORMS.length} forms loaded.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
