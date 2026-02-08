// lib/previsit-checklist.ts
// Pre-visit Briefing 체크리스트 v1 — 코드 상수 (AI 생성 아님)

export type ChecklistItemType = "text" | "yesno" | "scale" | "multi";

export type ChecklistItem = {
  id: string;
  label: string;
  type: ChecklistItemType;
  options?: string[];
  optional?: boolean;
  help?: string;
};

export type ChecklistSection = {
  id: string;
  title: string;
  optional?: boolean;
  items: ChecklistItem[];
};

export const PREVISIT_CHECKLIST_V1: ChecklistSection[] = [
  /* ── 0. 방문 목적 ── */
  {
    id: "sec0",
    title: "0. 방문 목적",
    items: [
      {
        id: "visitPurpose",
        label: "이번 진료에서 가장 해결하고 싶은 것은?",
        type: "text",
        help: "한 줄로 적어 주세요",
      },
    ],
  },

  /* ── 1. 주 증상 / 주호소 ── */
  {
    id: "sec1",
    title: "1. 주 증상 / 주호소",
    items: [
      {
        id: "topConcerns",
        label: "가장 불편한 증상 (최대 3개)",
        type: "text",
        help: "쉼표로 구분하여 입력",
      },
    ],
  },

  /* ── 2. 증상 상세 ── */
  {
    id: "sec2",
    title: "2. 증상 상세",
    items: [
      {
        id: "onset",
        label: "언제 시작되었나요?",
        type: "text",
        help: "예: 3일 전, 2주 전",
      },
      {
        id: "course",
        label: "경과는 어떤가요?",
        type: "multi",
        options: ["점점 악화", "비슷하게 유지", "좋아지는 중", "오락가락", "모름"],
      },
      {
        id: "location",
        label: "부위는 어디인가요?",
        type: "text",
        help: "예: 오른쪽 어깨, 양쪽 무릎",
      },
      {
        id: "quality",
        label: "어떤 느낌인가요?",
        type: "multi",
        options: ["욱신거림", "찌릿찌릿", "둔한 통증", "날카로운 통증", "조이는 느낌", "화끈거림", "기타"],
      },
      {
        id: "qualityEtc",
        label: "기타 느낌 (서술)",
        type: "text",
        optional: true,
      },
      {
        id: "severity",
        label: "강도 (0~10)",
        type: "scale",
        help: "0 = 전혀 없음, 10 = 참을 수 없음",
      },
      {
        id: "frequencyDuration",
        label: "얼마나 자주, 얼마나 오래 지속되나요?",
        type: "text",
        help: "예: 하루 3~4회, 각 30분씩",
      },
    ],
  },

  /* ── 3. 레드플래그 (위험 징후) ── */
  {
    id: "sec3",
    title: "3. 위험 징후 체크",
    items: [
      {
        id: "rf_chestPain",
        label: "갑작스러운 가슴 통증/압박감이 있나요?",
        type: "yesno",
      },
      {
        id: "rf_breathing",
        label: "호흡 곤란 또는 숨가쁨이 있나요?",
        type: "yesno",
      },
      {
        id: "rf_consciousness",
        label: "의식이 흐려지거나 실신한 적이 있나요?",
        type: "yesno",
      },
      {
        id: "rf_severeHeadache",
        label: "갑작스럽고 극심한 두통이 있나요?",
        type: "yesno",
      },
      {
        id: "rf_numbWeakness",
        label: "한쪽 팔/다리 마비 또는 힘빠짐이 있나요?",
        type: "yesno",
      },
      {
        id: "rf_bleeding",
        label: "지속적인 출혈(혈변, 혈뇨, 객혈 등)이 있나요?",
        type: "yesno",
      },
      {
        id: "rf_highFever",
        label: "39°C 이상 고열이 지속되나요?",
        type: "yesno",
      },
    ],
  },

  /* ── 4. 악화 / 완화 요인 ── */
  {
    id: "sec4",
    title: "4. 악화 / 완화 요인",
    items: [
      {
        id: "worseFactors",
        label: "증상이 악화되는 상황",
        type: "multi",
        options: ["활동 시", "안정 시", "특정 자세", "식후", "스트레스", "아침", "저녁/밤", "기타"],
      },
      {
        id: "worseFactorsEtc",
        label: "악화 요인 기타 (서술)",
        type: "text",
        optional: true,
      },
      {
        id: "reliefFactors",
        label: "증상이 완화되는 상황",
        type: "multi",
        options: ["휴식", "움직임", "냉찜질", "온찜질", "진통제 복용", "특정 자세", "기타"],
      },
      {
        id: "reliefFactorsEtc",
        label: "완화 요인 기타 (서술)",
        type: "text",
        optional: true,
      },
    ],
  },

  /* ── 5. 동반 증상 ── */
  {
    id: "sec5",
    title: "5. 동반 증상",
    items: [
      {
        id: "associatedSymptoms",
        label: "함께 나타나는 증상이 있나요?",
        type: "multi",
        options: [
          "두통", "어지러움", "메스꺼움/구토", "발열", "피로감",
          "수면장애", "식욕변화", "체중변화", "없음", "기타",
        ],
      },
      {
        id: "associatedSymptomsEtc",
        label: "동반 증상 기타 (서술)",
        type: "text",
        optional: true,
      },
    ],
  },

  /* ── 6. 최근 트리거 / 계기 ── */
  {
    id: "sec6",
    title: "6. 최근 트리거 / 계기",
    items: [
      {
        id: "recentTriggers",
        label: "최근 계기가 될 만한 사건이 있었나요?",
        type: "multi",
        options: ["외상/부상", "수술", "여행", "새로운 약 복용", "생활 변화", "감염(감기 등)", "없음", "기타"],
      },
      {
        id: "recentTriggersEtc",
        label: "트리거 기타 (서술)",
        type: "text",
        optional: true,
      },
    ],
  },

  /* ── 7. 현재 복용 약 / 보충제 (선택) ── */
  {
    id: "sec7",
    title: "7. 현재 복용 약 / 보충제",
    optional: true,
    items: [
      {
        id: "medsSupplements",
        label: "현재 복용 중인 약이나 보충제가 있나요?",
        type: "text",
        help: "약 이름, 용도 등 자유 서술",
      },
    ],
  },

  /* ── 8. 알레르기 / 이상반응 (선택) ── */
  {
    id: "sec8",
    title: "8. 알레르기 / 이상반응",
    optional: true,
    items: [
      {
        id: "allergies",
        label: "알려진 알레르기나 약물 이상반응이 있나요?",
        type: "text",
        help: "예: 페니실린 알레르기, 해산물 알레르기",
      },
    ],
  },

  /* ── 9. 과거 병력 / 검사 (선택) ── */
  {
    id: "sec9",
    title: "9. 과거 병력 / 검사",
    optional: true,
    items: [
      {
        id: "pastHistory",
        label: "관련된 과거 병력이나 검사 결과가 있나요?",
        type: "text",
        help: "진단명, 수술력, 최근 검사 결과 등",
      },
      {
        id: "familyHistory",
        label: "가족력이 있나요?",
        type: "text",
        optional: true,
        help: "관련된 가족 병력",
      },
    ],
  },

  /* ── 10. 생활습관 / 노출 / 임신 관련 (선택) ── */
  {
    id: "sec10",
    title: "10. 생활습관 / 노출 / 임신 관련",
    optional: true,
    items: [
      {
        id: "lifestyleExposure",
        label: "관련 생활습관이나 환경 노출이 있나요?",
        type: "text",
        optional: true,
        help: "흡연, 음주, 직업적 노출 등",
      },
      {
        id: "pregnancyRelated",
        label: "임신 가능성 또는 관련 사항이 있나요?",
        type: "yesno",
        optional: true,
      },
    ],
  },
];
