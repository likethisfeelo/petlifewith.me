"use client";

// 편집 폼 공통 훅 — 저장한 뒤에도 화면의 값이 그대로 남게 한다.
//
// <form action={서버액션}> 을 쓰면 React 는 액션이 끝난 뒤 폼을 "처음 값"으로 되돌린다(리셋).
// 새 글을 쓰는 폼에서는 편하지만, 편집 화면에서는 방금 고른 공개 상태나 고친 문구가
// 저장 직후 옛 값으로 보여 "저장이 안 됐다"고 오해하게 만든다. 그 상태로 한 번 더 저장하면
// 진짜로 옛 값이 덮어써진다(메이커가 공개 → 비공개로 되돌아가던 문제).
// 그래서 편집 폼은 onSubmit 으로 직접 보내고 리셋을 하지 않는다.
import { startTransition, useActionState, type FormEvent } from "react";

export function useKeptForm<S>(action: (prev: S, formData: FormData) => Promise<S>, initial: S) {
  // 제네릭 그대로는 useActionState 의 Awaited<S> 제약에 걸려, 경계에서만 unknown 으로 다룬다
  const [state, dispatch, pending] = useActionState<unknown, FormData>(
    action as unknown as (prev: unknown, formData: FormData) => Promise<unknown>,
    initial,
  );
  const formAction = dispatch as (formData: FormData) => void;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    // 눌린 제출 버튼의 name/value 는 FormData 에 자동으로 들어가지 않는다 (미리보기·임시저장 같은 버튼용)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null;
    if (submitter?.name) formData.append(submitter.name, submitter.value);
    startTransition(() => formAction(formData));
  };

  return { state: state as S, pending, onSubmit };
}
