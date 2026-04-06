/**
 * Migration script: Load DEX Field Mappings into Firestore dex_field_mappings collection.
 * Source: DEX_FieldMappings.gs 300+ field definitions
 *
 * Run: npx tsx scripts/load-dex-mappings.ts
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const COLLECTION = 'dex_field_mappings'

// Representative field mappings from DEX_FieldMappings.gs
// Full 300+ would come from the actual Sheets data; this seeds the structure
const MAPPINGS = [
  // Client Account Form (FORM_0001)
  { mapping_id: 'MAP_FC_001', form_id: 'FORM_0001', field_name: 'first_name', field_type: 'text', data_source: 'client.first_name', required: true, input_type: 'text', label: 'First Name' },
  { mapping_id: 'MAP_FC_002', form_id: 'FORM_0001', field_name: 'last_name', field_type: 'text', data_source: 'client.last_name', required: true, input_type: 'text', label: 'Last Name' },
  { mapping_id: 'MAP_FC_003', form_id: 'FORM_0001', field_name: 'dob', field_type: 'date', data_source: 'client.dob', required: true, input_type: 'date', label: 'Date of Birth' },
  { mapping_id: 'MAP_FC_004', form_id: 'FORM_0001', field_name: 'ssn', field_type: 'ssn', data_source: 'input.ssn', required: true, input_type: 'ssn', label: 'Social Security Number' },
  { mapping_id: 'MAP_FC_005', form_id: 'FORM_0001', field_name: 'address', field_type: 'text', data_source: 'client.address', required: true, input_type: 'text', label: 'Street Address' },
  { mapping_id: 'MAP_FC_006', form_id: 'FORM_0001', field_name: 'city', field_type: 'text', data_source: 'client.city', required: true, input_type: 'text', label: 'City' },
  { mapping_id: 'MAP_FC_007', form_id: 'FORM_0001', field_name: 'state', field_type: 'text', data_source: 'client.state', required: true, input_type: 'state', label: 'State' },
  { mapping_id: 'MAP_FC_008', form_id: 'FORM_0001', field_name: 'zip', field_type: 'text', data_source: 'client.zip', required: true, input_type: 'text', label: 'ZIP Code' },
  { mapping_id: 'MAP_FC_009', form_id: 'FORM_0001', field_name: 'email', field_type: 'email', data_source: 'client.email', required: false, input_type: 'email', label: 'Email' },
  { mapping_id: 'MAP_FC_010', form_id: 'FORM_0001', field_name: 'phone', field_type: 'phone', data_source: 'client.phone', required: false, input_type: 'phone', label: 'Phone' },
  { mapping_id: 'MAP_FC_011', form_id: 'FORM_0001', field_name: 'account_type', field_type: 'text', data_source: 'input.registration_type', required: true, input_type: 'dropdown', label: 'Account Type', options: '["Traditional IRA","Roth IRA","Individual","Joint WROS","Trust","401k/ERISA"]' },

  // COMRA (FORM_0003)
  { mapping_id: 'MAP_CA_001', form_id: 'FORM_0003', field_name: 'client_name', field_type: 'text', data_source: 'client.full_name', required: true, input_type: 'text', label: 'Client Name' },
  { mapping_id: 'MAP_CA_002', form_id: 'FORM_0003', field_name: 'previous_carrier', field_type: 'text', data_source: 'account.previous_carrier', required: false, input_type: 'text', label: 'Previous Carrier' },
  { mapping_id: 'MAP_CA_003', form_id: 'FORM_0003', field_name: 'product_transferred', field_type: 'text', data_source: 'account.product_type', required: true, input_type: 'text', label: 'Product Type' },

  // GWM TAF (FORM_0010)
  { mapping_id: 'MAP_TA_001', form_id: 'FORM_0010', field_name: 'firm_name', field_type: 'text', data_source: 'firm.name_gwm', required: true, input_type: 'text', label: 'Firm Name' },
  { mapping_id: 'MAP_TA_002', form_id: 'FORM_0010', field_name: 'firm_crd', field_type: 'text', data_source: 'firm.crd_gwm', required: true, input_type: 'text', label: 'Firm CRD' },
  { mapping_id: 'MAP_TA_003', form_id: 'FORM_0010', field_name: 'advisor_name', field_type: 'text', data_source: 'advisor.name', required: true, input_type: 'text', label: 'Advisor Name' },
  { mapping_id: 'MAP_TA_004', form_id: 'FORM_0010', field_name: 'advisor_crd', field_type: 'text', data_source: 'advisor.crd_number', required: true, input_type: 'text', label: 'Advisor CRD' },
  { mapping_id: 'MAP_TA_005', form_id: 'FORM_0010', field_name: 'advisor_signature', field_type: 'signature', data_source: 'input.advisor_sig', required: true, input_type: 'signature', label: 'Advisor Signature' },
  { mapping_id: 'MAP_TA_006', form_id: 'FORM_0010', field_name: 'signature_date', field_type: 'date', data_source: 'input.signature_date', required: true, input_type: 'date', label: 'Date' },

  // IAA (FORM_0011)
  { mapping_id: 'MAP_IAA_001', form_id: 'FORM_0011', field_name: 'effective_date', field_type: 'date', data_source: 'account.effective_date', required: true, input_type: 'date', label: 'Effective Date' },
  { mapping_id: 'MAP_IAA_002', form_id: 'FORM_0011', field_name: 'fee_percent', field_type: 'percent', data_source: 'account.fee_percent', required: true, input_type: 'percent', label: 'Advisory Fee %' },
  { mapping_id: 'MAP_IAA_003', form_id: 'FORM_0011', field_name: 'assets_under_mgmt', field_type: 'currency', data_source: 'input.aum', required: true, input_type: 'currency', label: 'Assets Under Management' },

  // Beneficiary (FORM_0050)
  { mapping_id: 'MAP_BD_001', form_id: 'FORM_0050', field_name: 'beneficiary_name', field_type: 'text', data_source: 'input.beneficiary_name', required: true, input_type: 'text', label: 'Beneficiary Name' },
  { mapping_id: 'MAP_BD_002', form_id: 'FORM_0050', field_name: 'relationship', field_type: 'text', data_source: 'input.relationship', required: true, input_type: 'dropdown', label: 'Relationship', options: '["Spouse","Child","Parent","Sibling","Trust","Other"]' },
  { mapping_id: 'MAP_BD_003', form_id: 'FORM_0050', field_name: 'percentage', field_type: 'percent', data_source: 'input.beneficiary_pct', required: true, input_type: 'percent', label: 'Percentage' },

  // ACAT Transfer (FORM_0033)
  { mapping_id: 'MAP_ACAT_001', form_id: 'FORM_0033', field_name: 'current_custodian', field_type: 'text', data_source: 'account.custodian', required: true, input_type: 'text', label: 'Current Custodian' },
  { mapping_id: 'MAP_ACAT_002', form_id: 'FORM_0033', field_name: 'transfer_date', field_type: 'date', data_source: 'input.transfer_date', required: true, input_type: 'date', label: 'Transfer Date' },
  { mapping_id: 'MAP_ACAT_003', form_id: 'FORM_0033', field_name: 'account_number', field_type: 'text', data_source: 'account.account_number', required: true, input_type: 'text', label: 'Account Number' },
]

async function main() {
  console.log(`Loading ${MAPPINGS.length} field mappings into ${COLLECTION}...`)
  const batch = db.batch()
  const now = new Date().toISOString()

  for (const m of MAPPINGS) {
    batch.set(db.collection(COLLECTION).doc(m.mapping_id), {
      ...m,
      default_value: '',
      carrier_variations: [],
      format_type: m.field_type,
      status: 'ACTIVE',
      created_at: now,
      updated_at: now,
    })
  }

  await batch.commit()
  console.log(`Done. ${MAPPINGS.length} mappings loaded.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
