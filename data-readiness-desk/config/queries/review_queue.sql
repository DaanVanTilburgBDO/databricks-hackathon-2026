SELECT
  unique_id,
  COALESCE(name, 'Unknown Facility') AS name,
  COALESCE(address_city, '') AS city,
  COALESCE(address_stateOrRegion, '') AS state,
  COALESCE(facilityTypeId, 'unknown') AS facility_type,
  CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END +
  CASE WHEN capability IS NULL OR capability IN ('', '[]') THEN 1 ELSE 0 END +
  CASE WHEN `procedure` IS NULL OR `procedure` IN ('', '[]') THEN 1 ELSE 0 END +
  CASE WHEN equipment IS NULL OR equipment IN ('', '[]') THEN 1 ELSE 0 END +
  CASE WHEN numberDoctors IS NULL OR numberDoctors = '' THEN 1 ELSE 0 END +
  CASE WHEN capacity IS NULL OR capacity = '' THEN 1 ELSE 0 END +
  CASE WHEN yearEstablished IS NULL OR yearEstablished = '' THEN 1 ELSE 0 END +
  CASE WHEN specialties IS NULL OR specialties IN ('', '[]') THEN 1 ELSE 0 END AS missing_field_count,
  (description IS NULL OR description = '')           AS missing_description,
  (numberDoctors IS NULL OR numberDoctors = '')       AS missing_doctors,
  (capacity IS NULL OR capacity = '')                 AS missing_capacity,
  (yearEstablished IS NULL OR yearEstablished = '')   AS missing_year,
  (specialties IS NULL OR specialties IN ('', '[]'))  AS missing_specialties,
  SUBSTRING(COALESCE(description, ''), 1, 150)        AS description_preview
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
ORDER BY missing_field_count DESC
LIMIT 100
