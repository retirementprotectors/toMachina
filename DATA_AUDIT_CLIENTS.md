# Client Data Integrity Audit - 2026-03-11

## Summary
- **Total clients**: 5019
- **Average quality score**: 72.5 / 100
- **Broken agent FKs**: 1
- **Duplicate GHL IDs**: 57
- **Potential duplicate groups**: 557

## Field Completeness

| Field | Populated | Empty | % Populated |
|-------|-----------|-------|-------------|
| first_name | 5017 | 2 | 100.0% |
| last_name | 5018 | 1 | 100.0% |
| email | 1769 | 3250 | 35.2% |
| phone | 3819 | 1200 | 76.1% |
| dob | 4299 | 720 | 85.7% |
| ssn_last4 | 0 | 5019 | 0.0% |
| status | 4993 | 26 | 99.5% |
| client_status | 4993 | 26 | 99.5% |
| client_classification | 0 | 5019 | 0.0% |
| state | 4410 | 609 | 87.9% |
| zip | 4381 | 638 | 87.3% |
| city | 3685 | 1334 | 73.4% |
| address | 3661 | 1358 | 72.9% |
| source | 5 | 5014 | 0.1% |
| created_at | 5018 | 1 | 100.0% |
| updated_at | 5018 | 1 | 100.0% |
| book_of_business | 4773 | 246 | 95.1% |
| agent_id | 2 | 5017 | 0.0% |

## FK Integrity

### agent_id -> agents collection
- Clients with agent_id: **2**
- Broken references (agent not found): **1**

Broken agent_id values (up to 20):
```
  josh.millang
```

### ghl_contact_id duplicates
- Clients with ghl_contact_id: **3655**
- Duplicate GHL IDs (multiple clients sharing same ID): **57**

Duplicate GHL ID groups (up to 20):
| GHL Contact ID | Client Count | Client IDs |
|---------------|-------------|------------|
| XkWr1hJRqO3nSELzkxzS | 2 | 00484ce2-04fd-497c-a2f9-5aa47eb0210f, 4b6ae892-d26a-4533-af3d-7374fa8e75f7 |
| rXV6khZCZ7STXic81RZS | 2 | 0255456c-c8da-44ac-82cc-9455174e38b8, 664fa269-0629-4a00-866d-d3046b367f04 |
| XdrVEwCkCqN7Mj41cIZF | 2 | 02d1ff8f-c928-4d4b-9f7c-6eedb9f454a9, 50ece13b-8131-498d-9b71-0cffce6b8517 |
| YMFBfSHiAa9QRgriPPoU | 2 | 044be1c0-223d-4b76-ac7e-087997ec2e66, 8d749826-ed1c-4467-9a17-56e132549225 |
| 692ZMjFYsnCkLWtA8BIL | 2 | 04e77b8f-e7c8-4fad-a5b5-bf4a47515d62, cbee73ff-762b-409c-b067-3aceb9e9b1b8 |
| 2cmOs46jnJfuPdqGqPMw | 2 | 04e79941-84e0-4fdf-9c36-c7158c2ffe23, 300dc2aa-e45b-4373-9293-28ba20df9a2e |
| B2BS0Ku6FNRpboVXmwa9 | 2 | 05200336-3250-4975-99c9-5fb8d94fb820, adf7ce50-e254-4c43-95f7-af54e081fd6f |
| 2c2CfuuzqCgnMsiFCmNV | 2 | 0971ddde-95c2-434d-89bd-65f5cfd8eb49, 74a9bf46-1933-400e-b1fb-bbb0d5660191 |
| SrnRlcygiLpGhp6TZsth | 2 | 098775f9-2dc7-458d-8924-212b74bd6805, 423ec217-46f8-4de5-a207-75697bc57a0e |
| jNfPlrrsKgM9O0Rjpv01 | 2 | 09a7952a-c0a2-4ee8-9e63-fd3699c86307, 5d2a8e09-c553-4a68-be2d-093dccbb2bf9 |
| lME0mGi3nHX2scDBRa7p | 7 | 0aa54b50-d917-4fd1-85af-db3c4caac815, 15a895d1-4986-4299-b03a-74382f3625ba, 39ed3812-dda8-4636-9dd1-f5b3362035ac, 52074d7c-cb98-4103-a8ea-b58edb759d25, 8c54bdea-cebb-4c26-9c56-ba907e47c240, a68a7145-5bb5-4fcd-9c41-5ec183a1af7e, e4b65468-117e-4aab-9665-0d6a63953bc7 |
| OIZNhBrcmTSfJRNof22S | 7 | 0b02cc6d-8221-4a1b-8da6-e84cdabe31d9, 122d53fe-c00f-49b3-accd-86538099bd13, 2a0f2741-5fde-4bff-b560-9985d0e567d3, 52006421-40ab-4121-b0f4-bf8928ca9679, 530514ae-f6f1-4cfa-abf1-7ab0221b568d, 7b364948-2374-438c-85ef-c668cfbd5754, 7ef5fe5e-e432-497c-ae22-287ba763bcdb |
| lqtXHDJinS5OXXaGH9gd | 2 | 0c9ab06b-93a9-4a77-8ae1-c4fcd9c59a0a, db13f38e-49d2-47e4-a786-1c568779fdef |
| rtbwpo0SXUS2LgIbTBYu | 2 | 0de53ad6-48c3-49c8-a496-4dbb8f11afb5, 48e5d7df-e4ba-44c8-b494-aa023314b1a3 |
| 6RcGl8tB9y43ZEgnz6Kv | 2 | 0dfb1139-bba2-44ea-bf25-6e33d0a823fc, 248aced1-fca3-40c0-9b8b-6dc933f038a2 |
| cKY38Y4rx3JwLDhHdw4X | 2 | 1f99bce3-27cf-4b36-bb60-a06504730f2f, 7a970376-ecf8-41af-9edf-94c3232dc899 |
| iacfgXxmhRMtCvC71T26 | 2 | 2076291a-a336-474c-914c-70d4d2efda2b, 6198332e-d5dd-496b-9c5e-b9dfb2af9cb3 |
| JGQUHEwon6kmkJliUdBl | 2 | 2842580c-cca7-42c2-987b-3ae5f5eaa65a, cce116aa-8cef-40af-b6b2-a9bbd51d1338 |
| B1nsbijzb4chFQ4laJi3 | 2 | 290817b4-92d6-4a35-a9be-268b779c1d54, ebd26994-f7a7-40d1-9bbf-ccde0b928716 |
| i3xuyApA0LsUwV2WAHvh | 2 | 2951b8b3-1dab-487a-a748-c3eab8f03d03, 31271984-ca48-46bc-82ed-e4b91e356ca7 |

## Duplicate Detection

### Email (normalized)
- Duplicate groups: **209**
- Total docs in duplicate groups: **448**

Top 10 groups:
| Key | Count | Client IDs |
|-----|-------|------------|
| spren888@gmail.com | 4 | 003bae5d-9ea9-4334-bd25-63268eb5e0f9, 2780db78-74db-4fc6-afe6-648997818ff9, 8b3d6877-7b57-411c-977a-7ab00dbd48b5, 9bf18dc7-f7a9-4f66-8038-588f5b439938 |
| susieq65025@yahoo.com | 4 | 53db01d4-bc23-4bd3-9724-a42d1e2a9cc0, 8370791a-a0b4-4e91-a634-e19250b72ec8, b4b4b2ea-2dd9-4489-a27b-898febbce735, c739afd8-4624-4702-b6b1-4d510d519034 |
| mabledunning@gmail.com | 3 | 04e77b8f-e7c8-4fad-a5b5-bf4a47515d62, 8da702d4-09c2-44fa-acb7-e55b3ae3ab01, cbee73ff-762b-409c-b067-3aceb9e9b1b8 |
| wandastoulil53@gmail.com | 3 | 05200336-3250-4975-99c9-5fb8d94fb820, abaffcaf-5d2f-4065-9d43-732d0c168fd1, adf7ce50-e254-4c43-95f7-af54e081fd6f |
| edelman.barb@gmail.com | 3 | 098775f9-2dc7-458d-8924-212b74bd6805, 423ec217-46f8-4de5-a207-75697bc57a0e, 8610d7cd-1cbc-4374-95ff-8a329f8276dd |
| bevjmel@yahoo.com | 3 | 0b7f45fc-1f75-4b56-83ba-818cc3669eef, 290817b4-92d6-4a35-a9be-268b779c1d54, ebd26994-f7a7-40d1-9bbf-ccde0b928716 |
| eparris@embarqmail.com | 3 | 0c9ab06b-93a9-4a77-8ae1-c4fcd9c59a0a, 75fbe14b-6866-4de4-b66b-ab228e53248c, db13f38e-49d2-47e4-a786-1c568779fdef |
| rmccuiston@we.rr.com | 3 | 0de53ad6-48c3-49c8-a496-4dbb8f11afb5, 48e5d7df-e4ba-44c8-b494-aa023314b1a3, f37b0155-d092-4eee-b4a4-c8ca81b7421d |
| wsuebill@msn.com | 3 | 11d8edf2-fe62-4e11-891f-e2fd680abffe, 2842580c-cca7-42c2-987b-3ae5f5eaa65a, cce116aa-8cef-40af-b6b2-a9bbd51d1338 |
| donna.luetkemeyer@gmail.com | 3 | 18638907-aa5c-433e-aa70-205230cb34b9, 399c476a-e54d-4bad-8880-892ee5d95486, c7c685d2-d921-4d85-8931-f855c94d26da |

### Phone (10-digit normalized)
- Duplicate groups: **347**
- Total docs in duplicate groups: **763**

Top 10 groups:
| Key | Count | Client IDs |
|-----|-------|------------|
| ***8711 | 5 | 00484ce2-04fd-497c-a2f9-5aa47eb0210f, 1f99bce3-27cf-4b36-bb60-a06504730f2f, 4b6ae892-d26a-4533-af3d-7374fa8e75f7, 4c670d6a-da4e-415f-9dbc-9f9086a19aed, 7a970376-ecf8-41af-9edf-94c3232dc899 |
| ***1272 | 5 | 2aab883a-398c-443c-ad90-a9df6aa358a1, 9584a842-1754-46e1-8cf2-a6708556a5a2, c332bad4-e772-4043-be5d-d086c8654e7e, d0be3151-9ac3-4813-971f-a82e462512df, fade1750-ae70-474c-b341-e7e3c2fb0d1a |
| ***6773 | 5 | 3f00b660-9e01-4eb8-8edc-6d574f100c16, 6f81c54e-2e99-4cf9-8958-1c3347cf4151, 968c1c49-41c9-44d2-a1ca-97521cbf7add, d0635db8-d0c5-4d08-bc2e-29d46c77a503, f65fcd0c-e3ca-489b-bac1-0d29cba1c5ff |
| ***2653 | 4 | 0255456c-c8da-44ac-82cc-9455174e38b8, 664fa269-0629-4a00-866d-d3046b367f04, 841d3b25-db46-48ca-bd82-aa1b818fff85, c997f428-465f-401c-b778-aa43516c33b8 |
| ***4967 | 4 | 0673fd5c-6a9d-4476-b020-6c5e48d0521c, 1d0950c0-e32b-4571-b375-64c7281eb8e3, 7b1f2d76-b3e5-4100-9c7d-e78678ae8a03, db60cfc3-1b56-4b94-a7c3-fdc2f17174ba |
| ***0486 | 4 | 3091eacf-a7aa-413e-9acf-eb67035cde43, 49f98db1-0739-4898-a9c0-8a297a3cce67, 69546fc7-a55d-44c4-9673-514f5665c38a, 85a58fa8-34e2-4a4d-822c-be51a090ce04 |
| ***2186 | 3 | 02d1ff8f-c928-4d4b-9f7c-6eedb9f454a9, 50ece13b-8131-498d-9b71-0cffce6b8517, 6049b5bb-9611-40b3-8b95-6636603b8afd |
| ***6602 | 3 | 04e79941-84e0-4fdf-9c36-c7158c2ffe23, 300dc2aa-e45b-4373-9293-28ba20df9a2e, 7552f62a-38b3-4c7d-afee-c183c08bdb3f |
| ***4711 | 3 | 05200336-3250-4975-99c9-5fb8d94fb820, abaffcaf-5d2f-4065-9d43-732d0c168fd1, adf7ce50-e254-4c43-95f7-af54e081fd6f |
| ***7257 | 3 | 05b51d96-d57c-43b8-b665-74505ed7461b, 0971ddde-95c2-434d-89bd-65f5cfd8eb49, 74a9bf46-1933-400e-b1fb-bbb0d5660191 |

### Name + DOB (first+last+dob)
- Duplicate groups: **1**
- Total docs in duplicate groups: **2**

Top 10 groups:
| Key | Count | Client IDs |
|-----|-------|------------|
| john|smith|1951-12-23 | 2 | 2e547c33-ae71-493b-ac2d-ac0ca7d0d841, 633da6da-b7f9-45e3-a5eb-7f8196cfdc38 |

## Quality Score Distribution

Average score: **72.5** / 100

| Bucket | Count | % |
|--------|-------|---|
| 0-20 | 1 | 0.0%  |
| 21-40 | 547 | 10.9% ##### |
| 41-60 | 623 | 12.4% ###### |
| 61-80 | 2322 | 46.3% ####################### |
| 81-100 | 1526 | 30.4% ############### |

### Lowest Quality Clients (bottom 10)
| Client ID | Score |
|-----------|-------|
| DELETED-DUP | 10 |
| 04a8a865-62a5-4c1c-911c-bad776b2b931 | 30 |
| 5959577b-085b-4e66-b90b-f180e4042b89 | 30 |
| 93568f81-3096-492f-9e47-eea29efd3657 | 30 |
| c868bfd7-d5f0-4aa7-904e-b9b9d9be7b8e | 30 |
| 00cd85a6-e587-460a-8b1d-9477de9af21d | 40 |
| 017cf03a-675e-4d63-9eac-659431fcc235 | 40 |
| 02de7200-a5b4-4ce9-aa74-7066ecd75f7d | 40 |
| 043e8e8a-1066-4072-8a8d-fa5568f35029 | 40 |
| 04971d15-ffbd-45f8-993d-451f4bee822d | 40 |

---
*Generated 2026-03-11T06:54:18.746Z by audit-clients.ts (read-only)*