"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorFallback extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 p-4">
          <p className="text-center text-stone-900">Произошла ошибка</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-stone-800 px-6 py-3 text-white hover:bg-stone-700"
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
