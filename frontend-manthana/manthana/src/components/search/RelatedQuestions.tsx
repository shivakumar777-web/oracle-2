"use client";

import React from "react";

interface RelatedQuestionsProps {
  questions: string[];
  onQuestionClick: (q: string) => void;
}

export default function RelatedQuestions({
  questions,
  onQuestionClick,
}: RelatedQuestionsProps) {
  if (!questions.length) return null;

  return (
    <section className="mb-5">
      <span className="block text-[10px] text-cream/30 font-mono tracking-widest uppercase mb-2">
        People also search
      </span>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => onQuestionClick(q)}
            className="text-[11px] px-3 py-1.5 rounded-full border border-[#C8922A]/20
              text-cream/60 hover:border-[#C8922A]/60 hover:text-[#C8922A]
              transition-all duration-150 text-left"
          >
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
