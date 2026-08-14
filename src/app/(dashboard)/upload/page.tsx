import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold mb-1">매출 데이터 업로드</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          기간을 지정하고 엑셀/CSV 파일을 올리면 그 기간의 스냅샷으로 저장됩니다.
          같은 기간으로 다시 업로드하면 기존 데이터를 덮어씁니다.
        </p>
      </div>

      <div className="bg-[var(--bg-neutral)] rounded-xl p-4 text-sm text-[var(--text-neutral)]">
        <p className="font-medium mb-2">파일 형식</p>
        <p className="mb-2">첫 번째 시트에 아래 4개 컬럼이 헤더로 있어야 합니다 (순서 무관):</p>
        <p className="font-mono text-xs bg-[var(--surface-2)] rounded p-2 mb-2">
          카테고리 | 메뉴명 | 수량 | 매출액
        </p>
        <p>배달앱/POS에서 내려받은 엑셀에 컬럼명이 다르면 위 이름으로 맞춰서 올려주세요.</p>
      </div>

      <UploadForm />
    </div>
  );
}
