import OperationManual from "../components/OperationManual";

export default function OrgDocs() {
  return (
    <div className="h-full -m-3 sm:-m-6">
      <OperationManual page="org-chart" onClose={() => window.history.back()} embedded />
    </div>
  );
}
