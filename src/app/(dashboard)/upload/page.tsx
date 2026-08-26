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

      <div className="bg-[var(--bg-neutral)] rounded-xl p-4 text-sm text-[var(--text-neutral)] space-y-3">
        <div>
          <p className="font-medium mb-2">지원하는 파일 형식 ①: 요기요 브랜드 주문 리포트</p>
          <p>
            요기요에서 내려받는 원본 CSV/엑셀(프랜차이즈명·가게명·메뉴유형 컬럼 포함)을
            그대로 업로드하면 됩니다. 매장별·메뉴별 매출이 자동으로 집계됩니다.
          </p>
        </div>
        <div>
          <p className="font-medium mb-2">지원하는 파일 형식 ②: 배민 가게별 주문 상세 리포트</p>
          <p>
            배달의민족 사장님광장에서 내려받는 &quot;가게별 주문 상세(취소, 옵션 포함)&quot;
            엑셀을 그대로 업로드하면 됩니다. 주문취소 건은 자동으로 제외됩니다.
          </p>
        </div>
        <div>
          <p className="font-medium mb-2">지원하는 파일 형식 ③: 자체 4컬럼 템플릿</p>
          <p className="mb-2">첫 번째 시트에 아래 4개 컬럼이 헤더로 있어야 합니다 (순서 무관, 매장 구분 없음):</p>
          <p className="font-mono text-xs bg-[var(--surface-2)] rounded p-2">
            카테고리 | 메뉴명 | 수량 | 매출액
          </p>
        </div>
        <div>
          <p className="font-medium mb-2">지원하는 파일 형식 ④: 배민 리뷰 목록</p>
          <p>
            배달의민족 사장님광장 리뷰 관리에서 내려받는 &quot;리뷰 목록&quot; CSV를 그대로
            업로드하면 매장·날짜·별점·긍정부정·사장님 답변 여부까지 자동으로 인식해서
            리뷰 탭에 반영됩니다. 같은 리뷰(날짜·매장·채널·내용이 모두 같음)를 다시
            업로드해도 중복 저장되지 않습니다.
          </p>
        </div>
      </div>

      <UploadForm />
    </div>
  );
}
