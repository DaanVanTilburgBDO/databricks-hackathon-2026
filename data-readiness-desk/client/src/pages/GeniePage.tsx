export function GeniePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-[#0B2026]">Ask questions about your data using Databricks AI/BI Genie</h2>
        <p className="mt-1 text-sm text-[#0B2026]/60">
          Use natural language to explore data quality issues, completeness gaps, and review decisions.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E7DED2] bg-white shadow-sm">
        <iframe
          src="https://dbc-cb0aa140-b16f.cloud.databricks.com/embed/genie/rooms/01f168f862221581bb986c8b28650873?o=7474645355849929"
          width="100%"
          height="700"
          frameBorder="0"
          allow="clipboard-write"
          title="Healthcare Facility Data Quality Genie"
          className="block"
        />
      </div>
    </div>
  );
}
