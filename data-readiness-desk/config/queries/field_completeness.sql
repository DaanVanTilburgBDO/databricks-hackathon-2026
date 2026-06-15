WITH base AS (
  SELECT
    COUNT(*) AS total,
    COUNT_IF(description IS NOT NULL AND description != '') AS description,
    COUNT_IF(capability IS NOT NULL AND capability NOT IN ('', '[]')) AS capability,
    COUNT_IF(`procedure` IS NOT NULL AND `procedure` NOT IN ('', '[]')) AS proc_col,
    COUNT_IF(equipment IS NOT NULL AND equipment NOT IN ('', '[]')) AS equipment,
    COUNT_IF(numberDoctors IS NOT NULL AND numberDoctors != '') AS numberDoctors,
    COUNT_IF(capacity IS NOT NULL AND capacity != '') AS capacity,
    COUNT_IF(yearEstablished IS NOT NULL AND yearEstablished != '') AS yearEstablished,
    COUNT_IF(specialties IS NOT NULL AND specialties NOT IN ('', '[]')) AS specialties
  FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
),
unpivoted AS (
  SELECT 'description'    AS field_name, description    AS present_count, total FROM base UNION ALL
  SELECT 'capability'     AS field_name, capability     AS present_count, total FROM base UNION ALL
  SELECT 'procedure'      AS field_name, proc_col       AS present_count, total FROM base UNION ALL
  SELECT 'equipment'      AS field_name, equipment      AS present_count, total FROM base UNION ALL
  SELECT 'numberDoctors'  AS field_name, numberDoctors  AS present_count, total FROM base UNION ALL
  SELECT 'capacity'       AS field_name, capacity       AS present_count, total FROM base UNION ALL
  SELECT 'yearEstablished' AS field_name, yearEstablished AS present_count, total FROM base UNION ALL
  SELECT 'specialties'    AS field_name, specialties    AS present_count, total FROM base
)
SELECT field_name, ROUND(100.0 * present_count / total, 1) AS pct_complete
FROM unpivoted
ORDER BY pct_complete ASC
