# DATA AUDIT: Accounts Subcollections

**Generated**: 2026-03-11T07:08:55.119Z
**Total Account Documents**: 17,137
**Scope**: `clients/*/accounts` (subcollection group query)

## 1a: Account Type Distribution

| Category | Count | % |
|----------|------:|--:|
| medicare | 11,095 | 64.7% |
| life | 5,036 | 29.4% |
| annuity | 1,006 | 5.9% |

## Status Distribution

| Status | Count | % |
|--------|------:|--:|
| Active | 11,189 | 65.3% |
| Deleted | 5,145 | 30.0% |
| Inactive | 574 | 3.3% |
| (empty) | 69 | 0.4% |
| Terminated | 67 | 0.4% |
| Pending | 56 | 0.3% |
| Attrited | 21 | 0.1% |
| Deceased | 6 | 0.0% |
| Surrendered | 3 | 0.0% |
| Matured | 3 | 0.0% |
| Not Active As Of | 1 | 0.0% |
| Rolled Over To Aspida | 1 | 0.0% |
| Claim | 1 | 0.0% |
| Pending Placement | 1 | 0.0% |

## Top 30 Carriers

| Carrier | Count |
|---------|------:|
| Aetna | 4,183 |
| Catholic Order of Foresters | 4,031 |
| UnitedHealthcare | 1,166 |
| Wellmark BCBS of Iowa | 900 |
| WellCare | 880 |
| Humana | 849 |
| Kansas City Life | 653 |
| Mutual of Omaha | 564 |
| Wellabe | 519 |
| Guarantee Trust Life | 227 |
| North American Company | 215 |
| BlueKC | 182 |
| Corebridge | 136 |
| Americo | 109 |
| Allstate | 106 |
| Cigna | 92 |
| Aflac | 88 |
| Continental Life | 87 |
| Equitable | 85 |
| Nassau | 84 |
| Medico | 74 |
| Lumico | 70 |
| SilverScript | 62 |
| Central States Indemnity | 50 |
| ACE | 50 |
| Delaware Life | 50 |
| Ameritas | 48 |
| Elevance | 45 |
| Assurity Life | 42 |
| Jackson National Life | 40 |
| *(56 more)* | |

## 1b: Field Completeness by Account Type

### life (5,036 accounts)

| Field | Present | Missing | Fill Rate |
|-------|--------:|--------:|----------:|
| premium | 0 | 5,036 | 0.0% **LOW** |
| effective_date | 0 | 5,036 | 0.0% **LOW** |
| product_type | 937 | 4,099 | 18.6% **LOW** |
| face_amount | 969 | 4,067 | 19.2% **LOW** |
| issue_date | 1,481 | 3,555 | 29.4% **LOW** |
| product_name | 1,922 | 3,114 | 38.2% **LOW** |
| carrier_name | 4,950 | 86 | 98.3% |
| status | 4,976 | 60 | 98.8% |
| policy_number | 5,013 | 23 | 99.5% |
| client_id | 5,036 | 0 | 100.0% |

### medicare (11,095 accounts)

| Field | Present | Missing | Fill Rate |
|-------|--------:|--------:|----------:|
| premium | 0 | 11,095 | 0.0% **LOW** |
| effective_date | 2,949 | 8,146 | 26.6% **LOW** |
| product_type | 5,507 | 5,588 | 49.6% **LOW** |
| plan_name | 8,304 | 2,791 | 74.8% |
| policy_number | 9,271 | 1,824 | 83.6% |
| carrier_name | 10,290 | 805 | 92.7% |
| status | 11,092 | 3 | 100.0% |
| client_id | 11,095 | 0 | 100.0% |

### annuity (1,006 accounts)

| Field | Present | Missing | Fill Rate |
|-------|--------:|--------:|----------:|
| policy_number | 0 | 1,006 | 0.0% **LOW** |
| premium | 0 | 1,006 | 0.0% **LOW** |
| effective_date | 0 | 1,006 | 0.0% **LOW** |
| account_value | 499 | 507 | 49.6% **LOW** |
| issue_date | 729 | 277 | 72.5% |
| product_type | 806 | 200 | 80.1% |
| product_name | 948 | 58 | 94.2% |
| carrier_name | 995 | 11 | 98.9% |
| status | 1,000 | 6 | 99.4% |
| client_id | 1,006 | 0 | 100.0% |

## 1c: FK Integrity

| FK Field | Docs with FK | Missing in Reference | Hit Rate |
|----------|-------------:|---------------------:|---------:|
| carrier_name -> carriers | 16,235 | 57 | 99.6% |
| product_name -> products | 2,870 | 200 | 93.0% |
| agent_id -> agents | 0 | 0 | N/A% |

### Missing Carrier Names (unique values, top 30)

| Carrier Name | Occurrences |
|--------------|------------:|
| Devoted Health | 36 |
| F&G Life | 13 |
| Consolidated | 4 |
| Oceanview Life and Annuity | 1 |
| Life Insurance Company | 1 |
| Employer Benefits | 1 |
| Primerica | 1 |

### Missing Product Names (unique values, top 30)

| Product Name | Occurrences |
|--------------|------------:|
| FlexWealth Advantage | 13 |
| AG Choice 10 | 11 |
| Life Protector | 9 |
| Final Expense Life | 8 |
| Indexed Universal Life | 7 |
| CLT (TERM TO AGE 25) | 7 |
| Perspective II | 5 |
| Basic Value Life-2001 CSO 4% | 5 |
| Retirement Cornerstone | 5 |
| Modified W/L PD 65 80CSO 5% | 4 |
| Flexible Premium Life | 4 |
| TERM TO 25 (NO COMMISSIONS) | 4 |
| Income Pay Pro | 4 |
| Basic Value Life-Monor 2017 CSO3% | 4 |
| Term Life | 3 |
| Level Shield Selector | 3 |
| BenefitSolutions 10 | 3 |
| Life Paid 65 80CSO 5% | 3 |
| Living Promise Final Expense | 3 |
| VersaChoice 10 | 3 |
| SPIA | 3 |
| Travel Accidental Death | 3 |
| SuperNOVA | 3 |
| Value 4 Life | 3 |
| IncomeVantage Pro | 3 |
| GrowthTrack | 3 |
| 10 PAY WHOLE LIFE 2001CSO 4% | 3 |
| TERM TO 35 2001 CSO | 3 |
| 20 YEAR RENEWABLE TERM 2001 CSO 4% | 2 |
| Forester Life (1400 Series) | 2 |

## 1d: Orphan Detection

**Accounts with missing parent client**: 57
**Duplicate accounts** (same client + policy_number): 2756

### Orphan Accounts (sample, max 20)

| Doc Path | Client ID |
|----------|-----------|
| clients/0586de5c-ae94-4a7e-bcf0-74c308cefc66/accounts/5c771938-20b7-4f0e-9702-ab65af26ed9c | 0586de5c-ae94-4a7e-bcf0-74c308cefc66 |
| clients/05e65f34-606d-4ce5-8bc2-3576a7288ae5/accounts/0671a096-2399-4202-9b02-7b3616d44756 | 05e65f34-606d-4ce5-8bc2-3576a7288ae5 |
| clients/05e65f34-606d-4ce5-8bc2-3576a7288ae5/accounts/956071e5-5438-4043-a307-dfbdf0cef340 | 05e65f34-606d-4ce5-8bc2-3576a7288ae5 |
| clients/05e65f34-606d-4ce5-8bc2-3576a7288ae5/accounts/dd3724ef-4844-4556-92af-07bf062d6378 | 05e65f34-606d-4ce5-8bc2-3576a7288ae5 |
| clients/238fcf1e-6373-419d-bd3c-0fc96e2a2394/accounts/34a82165-e8d7-417d-81a8-afe285e0e86e | 238fcf1e-6373-419d-bd3c-0fc96e2a2394 |
| clients/238fcf1e-6373-419d-bd3c-0fc96e2a2394/accounts/c6767a49-2b5b-4929-a5be-466df726bd40 | 238fcf1e-6373-419d-bd3c-0fc96e2a2394 |
| clients/35ba77c1-2853-491f-b899-39c0bc04b8b2/accounts/48124931-8306-4389-bcc5-c9366926d16c | 35ba77c1-2853-491f-b899-39c0bc04b8b2 |
| clients/35ba77c1-2853-491f-b899-39c0bc04b8b2/accounts/57a2b4c8-d704-43de-8bde-e63f108ea2a8 | 35ba77c1-2853-491f-b899-39c0bc04b8b2 |
| clients/35ba77c1-2853-491f-b899-39c0bc04b8b2/accounts/74f5ae63-d810-43f9-a7f0-5bb72801fbf9 | 35ba77c1-2853-491f-b899-39c0bc04b8b2 |
| clients/39f1b468-d8aa-4dcf-969e-2f79010c4dab/accounts/137bd9be-6953-4636-a497-f90723b85212 | 39f1b468-d8aa-4dcf-969e-2f79010c4dab |
| clients/480f2d92-ee24-4eb9-a8be-f671ea77609d/accounts/d9db9f7d-b9cc-4be7-a532-698ff2dcabb1 | 480f2d92-ee24-4eb9-a8be-f671ea77609d |
| clients/7b85dbb9-7570-48c2-960d-6621159681f3/accounts/65ef7bac-0b01-44bc-b5f1-93588408b0f2 | 7b85dbb9-7570-48c2-960d-6621159681f3 |
| clients/7b85dbb9-7570-48c2-960d-6621159681f3/accounts/a2383d24-08f7-4b35-8f8e-917869866774 | 7b85dbb9-7570-48c2-960d-6621159681f3 |
| clients/7b85dbb9-7570-48c2-960d-6621159681f3/accounts/e5504861-7c4c-4668-898d-a7fbf9540496 | 7b85dbb9-7570-48c2-960d-6621159681f3 |
| clients/Brian/accounts/52a862a2-b29b-4629-a08f-acb979196321 | Brian |
| clients/NEW_10/accounts/5fd0c6f2-d725-4f97-99db-c028c873e083 | NEW_10 |
| clients/NEW_10/accounts/87acfe10-67d2-46ca-9054-35f08cca4771 | NEW_10 |
| clients/NEW_149/accounts/31bed052-f1e7-44d9-8fc1-554921594fa1 | NEW_149 |
| clients/NEW_211/accounts/3d92998f-b011-4294-858a-fe78f6096736 | NEW_211 |
| clients/NEW_211/accounts/c29f5b7a-ba0c-4ffd-96fd-9cc7b2bb8d3f | NEW_211 |

### Duplicate Accounts (sample, max 20)

| Client + Policy | Count | Paths |
|-----------------|------:|-------|
| 001edca0-c806-4121-b95d-26e4a485ca15::141020 | 2 | clients/001edca0-c806-4121-b95d-26e4a485ca15/accounts/141020, clients/001edca0-c806-4121-b95d-26e4a485ca15/accounts/f38fac6e-b6fd-4ea8-bd85-eaae66bdf217 |
| 001edca0-c806-4121-b95d-26e4a485ca15::W00141020 | 2 | clients/001edca0-c806-4121-b95d-26e4a485ca15/accounts/W00141020, clients/001edca0-c806-4121-b95d-26e4a485ca15/accounts/dded90c6-af9d-4619-803f-32932ed4bf24 |
| 003a7a34-888d-43a1-b809-97e6bb465f23::948084837 | 3 | clients/003a7a34-888d-43a1-b809-97e6bb465f23/accounts/948084837, clients/003a7a34-888d-43a1-b809-97e6bb465f23/accounts/9fb0da7e-4f2c-4808-a0f2-7b6ba8925021, clients/003a7a34-888d-43a1-b809-97e6bb465f23/accounts/d6a1da56-66f2-4d6b-973d-e929e517eacf |
| 009898e1-f621-4a68-99a1-c62b65877262::1314246 | 2 | clients/009898e1-f621-4a68-99a1-c62b65877262/accounts/1314246, clients/009898e1-f621-4a68-99a1-c62b65877262/accounts/30bce953-13a5-4731-adeb-585479daae50 |
| 009898e1-f621-4a68-99a1-c62b65877262::W01314246 | 2 | clients/009898e1-f621-4a68-99a1-c62b65877262/accounts/W01314246, clients/009898e1-f621-4a68-99a1-c62b65877262/accounts/f085e9a5-d1d3-4f67-ac9c-80ce71716929 |
| 00abef9f-5bde-40cb-b112-7ac51aabbe17::130 | 3 | clients/00abef9f-5bde-40cb-b112-7ac51aabbe17/accounts/130, clients/00abef9f-5bde-40cb-b112-7ac51aabbe17/accounts/764b044f-da97-4a70-8f0f-66e45f4163ec, clients/00abef9f-5bde-40cb-b112-7ac51aabbe17/accounts/858db8ed-32c3-4b6e-bab9-be8ca0871b41 |
| 00c190ad-6f43-4bd5-9340-d499607a1ea0::19406559 | 2 | clients/00c190ad-6f43-4bd5-9340-d499607a1ea0/accounts/19406559, clients/00c190ad-6f43-4bd5-9340-d499607a1ea0/accounts/cc9ebce8-3574-44e3-a2d8-fc104df1e104 |
| 00c190ad-6f43-4bd5-9340-d499607a1ea0::2270474 | 2 | clients/00c190ad-6f43-4bd5-9340-d499607a1ea0/accounts/2270474, clients/00c190ad-6f43-4bd5-9340-d499607a1ea0/accounts/2bf3d9b7-ddd2-4426-8653-744038d0dfb4 |
| 00c190ad-6f43-4bd5-9340-d499607a1ea0::A02270474 | 2 | clients/00c190ad-6f43-4bd5-9340-d499607a1ea0/accounts/36b2aa17-ad44-4c0b-9e44-553cd0a84d59, clients/00c190ad-6f43-4bd5-9340-d499607a1ea0/accounts/A02270474 |
| 00c8768d-b263-47c9-b43d-4dc785ba7050::36694 | 3 | clients/00c8768d-b263-47c9-b43d-4dc785ba7050/accounts/36694, clients/00c8768d-b263-47c9-b43d-4dc785ba7050/accounts/741bcce4-15b3-47ff-9b8f-d317aa0a5586, clients/00c8768d-b263-47c9-b43d-4dc785ba7050/accounts/d0861a35-56cb-4410-b724-49bec4b6ad0c |
| 00c8768d-b263-47c9-b43d-4dc785ba7050::52500165991 | 2 | clients/00c8768d-b263-47c9-b43d-4dc785ba7050/accounts/52500165991, clients/00c8768d-b263-47c9-b43d-4dc785ba7050/accounts/ddb53424-14a8-4073-a059-87651a69b5ec |
| 016402d8-073f-47fe-8479-7f2536cd85d2::27855826 | 2 | clients/016402d8-073f-47fe-8479-7f2536cd85d2/accounts/0fcfe20b-cb45-4146-b090-f32769e01306, clients/016402d8-073f-47fe-8479-7f2536cd85d2/accounts/27855826 |
| 016f7278-ce2b-4830-b803-7fc2f7261386::101815396900 | 2 | clients/016f7278-ce2b-4830-b803-7fc2f7261386/accounts/55396199-4b49-4862-98b5-8602f9c85b39, clients/016f7278-ce2b-4830-b803-7fc2f7261386/accounts/9d0c17dc-97e5-4a0d-91ae-f114e9bec746 |
| 016f7278-ce2b-4830-b803-7fc2f7261386::W14039656 | 2 | clients/016f7278-ce2b-4830-b803-7fc2f7261386/accounts/5ca1ad38-5b51-4fb1-9679-b22c55a2a10e, clients/016f7278-ce2b-4830-b803-7fc2f7261386/accounts/900f25b2-86e7-49eb-886e-597c13da8515 |
| 016f7278-ce2b-4830-b803-7fc2f7261386::74825163 | 2 | clients/016f7278-ce2b-4830-b803-7fc2f7261386/accounts/74825163, clients/016f7278-ce2b-4830-b803-7fc2f7261386/accounts/f6ad3f39-7629-400c-aef2-f3a4d9685c02 |
| 017cf03a-675e-4d63-9eac-659431fcc235::1382597 | 2 | clients/017cf03a-675e-4d63-9eac-659431fcc235/accounts/223039be-d4c7-45d8-8a16-77fd9064a562, clients/017cf03a-675e-4d63-9eac-659431fcc235/accounts/2c96ffab-5c77-4901-bc50-296b06d28318 |
| 01943ddc-06d8-4132-ae34-0e1c00d44af9::1027106 | 3 | clients/01943ddc-06d8-4132-ae34-0e1c00d44af9/accounts/1027106, clients/01943ddc-06d8-4132-ae34-0e1c00d44af9/accounts/9556df41-51ff-4b96-8f51-58d2c2133d1d, clients/01943ddc-06d8-4132-ae34-0e1c00d44af9/accounts/984bf6cb-f1bb-4104-b892-e730e42f9f30 |
| 01af0e87-e385-4658-8fb2-342d8b22933e::818014 | 2 | clients/01af0e87-e385-4658-8fb2-342d8b22933e/accounts/818014, clients/01af0e87-e385-4658-8fb2-342d8b22933e/accounts/bf9e6825-56b2-4575-ae6f-bd6383f93179 |
| 01c7d5ed-7b92-4f59-9347-3aead5290bc3::10665344 | 3 | clients/01c7d5ed-7b92-4f59-9347-3aead5290bc3/accounts/10665344, clients/01c7d5ed-7b92-4f59-9347-3aead5290bc3/accounts/70b6dafc-b1fb-4669-b117-17bcbc41b7f0, clients/01c7d5ed-7b92-4f59-9347-3aead5290bc3/accounts/b84658df-8fa8-47c6-a94d-32c5bbef5d3d |
| 01cb4125-e766-4480-b0f1-8f4d40879a08::437564 | 3 | clients/01cb4125-e766-4480-b0f1-8f4d40879a08/accounts/437564, clients/01cb4125-e766-4480-b0f1-8f4d40879a08/accounts/c60e1072-d888-40bd-8050-7a303b70b1eb, clients/01cb4125-e766-4480-b0f1-8f4d40879a08/accounts/e1317bd8-8619-4eb6-a519-f1d835b6bd79 |

## 1e: Empty Document Detection

**Documents with < 3 non-empty fields**: 0

## Field Frequency (all observed fields)

| Field | Occurrences | % of Accounts |
|-------|------------:|--------------:|
| created_at | 17,137 | 100.0% |
| account_type_category | 17,137 | 100.0% |
| client_id | 17,137 | 100.0% |
| updated_at | 17,137 | 100.0% |
| import_source | 17,136 | 100.0% |
| status | 17,068 | 99.6% |
| carrier_name | 16,235 | 94.7% |
| book_of_business | 14,772 | 86.2% |
| policy_number | 14,284 | 83.4% |
| account_id | 12,540 | 73.2% |
| medicare_id | 11,095 | 64.7% |
| market | 8,784 | 51.3% |
| plan_name | 8,304 | 48.5% |
| core_product_type | 7,836 | 45.7% |
| product_type | 7,250 | 42.3% |
| ghl_object_id | 7,245 | 42.3% |
| ghl_contact_id | 7,104 | 41.5% |
| life_id | 5,036 | 29.4% |
| ancillary_type | 3,430 | 20.0% |
| effective_date | 2,949 | 17.2% |
| product_name | 2,870 | 16.7% |
| issue_date | 2,210 | 12.9% |
| policy_type | 1,899 | 11.1% |
| writing_agent_id | 1,767 | 10.3% |
| premium_mode | 1,616 | 9.4% |
| data_source | 1,470 | 8.6% |
| surrender_value | 1,453 | 8.5% |
| cms_plan_code | 1,340 | 7.8% |
| medicare_beneficiary_id | 1,306 | 7.6% |
| annual_premium | 1,249 | 7.3% |
| acf_link | 1,182 | 6.9% |
| plan_letter | 1,141 | 6.7% |
| annuity_id | 1,006 | 5.9% |
| health_class | 982 | 5.7% |
| insured_name | 980 | 5.7% |
| insured_gender | 978 | 5.7% |
| insured_dob | 978 | 5.7% |
| face_amount | 969 | 5.7% |
| scheduled_premium | 964 | 5.6% |
| account_number | 933 | 5.4% |
| cash_value | 891 | 5.2% |
| account_type | 883 | 5.2% |
| election_type | 752 | 4.4% |
| policy_owner | 708 | 4.1% |
| mapd_type | 642 | 3.7% |
| monthly_premium | 636 | 3.7% |
| death_benefit | 604 | 3.5% |
| dividend_option_1 | 538 | 3.1% |
| as_of_date | 508 | 3.0% |
| commission_split | 507 | 3.0% |
| account_value | 499 | 2.9% |
| submitted_date | 494 | 2.9% |
| carrier_sales_type | 494 | 2.9% |
| agent_writing_number | 493 | 2.9% |
| tax_status | 482 | 2.8% |
| carrier_application_status | 456 | 2.7% |
| commissionable_premium | 425 | 2.5% |
| planned_premium | 401 | 2.3% |
| net_deposits | 391 | 2.3% |
| parent_carrier | 367 | 2.1% |
| current_year_dividend | 291 | 1.7% |
| prior_year_dividend | 274 | 1.6% |
| income_benefit | 265 | 1.5% |
| account_owner | 205 | 1.2% |
| term_date | 147 | 0.9% |
| underwriting_status | 147 | 0.9% |
| total_premiums_paid | 118 | 0.7% |
| death_benefit_option | 118 | 0.7% |
| is_mec | 94 | 0.5% |
| loan_balance | 73 | 0.4% |
| benefit_base | 62 | 0.4% |
| insured | 45 | 0.3% |
| contract_number | 38 | 0.2% |
| fixed_rate | 37 | 0.2% |
| annuitant | 30 | 0.2% |
| ltc_benefit | 21 | 0.1% |
| rmd_calculated | 16 | 0.1% |
| rmd_remaining | 15 | 0.1% |
| has_income_rider | 14 | 0.1% |
| beneficiaries | 14 | 0.1% |
| prior_year_fmv | 13 | 0.1% |
| part_b_giveback | 13 | 0.1% |
| return_cumulative | 11 | 0.1% |
| termination_reason | 10 | 0.1% |
| return_annualized | 10 | 0.1% |
| contract_id | 9 | 0.1% |
| enrollment_period | 9 | 0.1% |
| income_gross | 8 | 0.0% |
| primary_beneficiary | 6 | 0.0% |
| joint_owner | 6 | 0.0% |
| income_frequency | 6 | 0.0% |
| dividend_balance | 6 | 0.0% |
| surrender_schedule | 6 | 0.0% |
| maturity_date | 5 | 0.0% |
| premium_frequency | 5 | 0.0% |
| contingent_beneficiary | 4 | 0.0% |
| primary_beneficiary_pct | 4 | 0.0% |
| guaranteed_minimum | 4 | 0.0% |
| loan_interest_rate | 4 | 0.0% |
| participation_rate | 4 | 0.0% |
| draft_date | 3 | 0.0% |
| rider_name | 3 | 0.0% |
| rider_fee | 3 | 0.0% |
| term_period | 3 | 0.0% |
| discount_types | 2 | 0.0% |
| contingent_beneficiary_pct | 2 | 0.0% |
| myga_rate | 2 | 0.0% |
| joint_annuitant | 2 | 0.0% |
| withdrawal_percentage | 2 | 0.0% |
| table_rating | 2 | 0.0% |
| cumulative_rate_increase | 1 | 0.0% |
| myga_period | 1 | 0.0% |
| income_type | 1 | 0.0% |
| cap_rate | 1 | 0.0% |
| income_base | 1 | 0.0% |
| death_benefit_rider | 1 | 0.0% |

---

## Post-Fix Audit (Phase 4: Business Decision Fixes)

**Timestamp**: 2026-03-11T07:09Z
**Applied after**: Phase 1-3 audit/normalize/fix + Phase 4 business decision fixes

### What Changed

| Fix | Action | Count |
|-----|--------|------:|
| 4a: "T" status | Updated to "Terminated" | 15 |
| 4b: Orphan accounts | Flagged `_flagged: 'orphan_no_parent_client'` | 57 |
| 4c: Missing carrier refs | Alias-resolved | 67 |
| 4c: Missing carrier refs | Fuzzy-resolved (>80%) | 40 |
| 4c: Missing carrier refs | Flagged `_flagged: 'unknown_carrier'` | 2 |
| 4d: Duplicate accounts | Flagged `_flagged: 'duplicate'` with `_dedup_kept` pointer | 3,163 |

### Status Distribution (Final)

| Status | Before Phase 4 | After Phase 4 | Delta |
|--------|---------------:|--------------:|------:|
| Active | 11,189 | 11,189 | 0 |
| Deleted | 5,145 | 5,145 | 0 |
| Inactive | 574 | 574 | 0 |
| (empty) | 69 | 69 | 0 |
| Terminated | 52 | **67** | **+15** (absorbed "T") |
| Pending | 56 | 56 | 0 |
| T | 15 | **0** | **-15** (resolved) |

### FK Integrity (Final)

| FK Field | Before Phase 4 | After Phase 4 | Delta |
|----------|---------------:|--------------:|------:|
| carrier_name -> carriers (missing) | 69 | **57** | **-12** |
| product_name -> products (missing) | 200 | 200 | 0 |

The remaining 57 carrier FK misses are names correctly resolved to canonical forms (Devoted Health, F&G Life, Consolidated, etc.) but those carriers don't exist in the `carriers` Firestore collection. The account data is correct -- the carriers reference collection needs these entries added.

### Dedup Results

| Metric | Value |
|--------|------:|
| Unique groups (client + policy + carrier) | 11,121 |
| Duplicate groups | 2,324 |
| Winners (kept) | 2,324 |
| Losers (flagged) | 3,163 |
| Group size distribution: 2 | 1,648 |
| Group size distribution: 3 | 579 |
| Group size distribution: 4 | 57 |
| Group size distribution: 5 | 15 |
| Group size distribution: 6 | 24 |
| Group size distribution: 7 | 1 |

### Carrier Alias Resolutions (4c)

| Original | Resolved To | Method | Count |
|----------|-------------|--------|------:|
| Devoted Health | Devoted Health | alias | 36 |
| Fg | F&G Life | alias | 13 |
| F&G Life | Fg Life | fuzzy (carriers collection name) | 40 |
| Agcorebridge | Corebridge | alias | 3 |
| Ace Property Casualty Insurance Company | ACE | alias | 3 |
| National General Insurance | Allstate | alias | 3 |
| Lincoln Benefit Life May Be External | Lincoln Benefit Life | alias | 1 |
| Oceanview | Oceanview Life and Annuity | alias | 1 |
| Jackson Life | Jackson National Life | alias | 1 |
| Columbus Life Insurance Company | Columbus Life | alias | 1 |
| Primerica- 10 Yr Term | Primerica | alias | 1 |
| Life Insurance Company | *(flagged unknown)* | -- | 1 |
| Employer Benefits | *(flagged unknown)* | -- | 1 |

### New Carrier Aliases Added

Added 24 new entries to `CARRIER_ALIASES` in `packages/core/src/normalizers/field-normalizers.ts`:

- Devoted Health, F&G Life (fg, fgl, fidelity guaranty), Corebridge (agcorebridge), ACE (ace property casualty), Allstate (national general insurance, natgen), Lincoln Benefit Life, Oceanview Life and Annuity, Jackson National Life (jackson life, jackson national, jackson), Columbus Life, Primerica, Consolidated
