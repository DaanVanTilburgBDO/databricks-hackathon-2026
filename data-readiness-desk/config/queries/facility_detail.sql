-- @param facility_id STRING
SELECT
  unique_id,
  COALESCE(name, '') AS name,
  COALESCE(organization_type, '') AS organization_type,
  COALESCE(facilityTypeId, '') AS facility_type,
  COALESCE(operatorTypeId, '') AS operator_type,
  COALESCE(address_line1, '') AS address_line1,
  COALESCE(address_line2, '') AS address_line2,
  COALESCE(address_line3, '') AS address_line3,
  COALESCE(address_city, '') AS city,
  COALESCE(address_stateOrRegion, '') AS state,
  COALESCE(address_zipOrPostcode, '') AS postcode,
  latitude,
  longitude,
  COALESCE(description, '') AS description,
  COALESCE(capability, '') AS capability,
  COALESCE(`procedure`, '') AS procedure_text,
  COALESCE(equipment, '') AS equipment,
  COALESCE(specialties, '') AS specialties,
  COALESCE(numberDoctors, '') AS number_doctors,
  COALESCE(capacity, '') AS capacity,
  COALESCE(yearEstablished, '') AS year_established,
  COALESCE(websites, '') AS websites,
  COALESCE(source_urls, '') AS source_urls,
  COALESCE(phone_numbers, '') AS phone_numbers,
  COALESCE(email, '') AS email
FROM databricks_virtue_foundation_dataset_dais_2026.virtue_foundation_dataset.facilities
WHERE unique_id = :facility_id
LIMIT 1
