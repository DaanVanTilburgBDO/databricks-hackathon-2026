SELECT
  COALESCE(address_stateOrRegion, 'Unknown') AS state,
  COUNT(*) AS facility_count,
  ROUND(100.0 * COUNT_IF(description IS NOT NULL AND description != '') / COUNT(*), 1) AS desc_pct,
  ROUND(100.0 * COUNT_IF(capability IS NOT NULL AND capability NOT IN ('', '[]')) / COUNT(*), 1) AS capability_pct
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
GROUP BY address_stateOrRegion
ORDER BY facility_count DESC
LIMIT 20
