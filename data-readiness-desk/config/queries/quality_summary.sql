WITH scored AS (
  SELECT
    CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END +
    CASE WHEN capability IS NULL OR capability IN ('', '[]') THEN 1 ELSE 0 END +
    CASE WHEN `procedure` IS NULL OR `procedure` IN ('', '[]') THEN 1 ELSE 0 END +
    CASE WHEN equipment IS NULL OR equipment IN ('', '[]') THEN 1 ELSE 0 END +
    CASE WHEN numberDoctors IS NULL OR numberDoctors = '' THEN 1 ELSE 0 END +
    CASE WHEN capacity IS NULL OR capacity = '' THEN 1 ELSE 0 END +
    CASE WHEN yearEstablished IS NULL OR yearEstablished = '' THEN 1 ELSE 0 END +
    CASE WHEN specialties IS NULL OR specialties IN ('', '[]') THEN 1 ELSE 0 END
    AS missing_count
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
)
SELECT
  COUNT(*)                           AS total_facilities,
  COUNT_IF(missing_count >= 5)       AS high_priority,
  COUNT_IF(missing_count BETWEEN 3 AND 4) AS medium_priority,
  COUNT_IF(missing_count < 3)        AS low_priority
FROM scored
