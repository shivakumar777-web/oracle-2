"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-white/[0.04] rounded ${className}`} />
  );
}

export function ChatSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4">
      {/* User bubble */}
      <div className="flex justify-end">
        <Skeleton className="h-12 w-64 rounded-2xl rounded-tr-sm" />
      </div>
      {/* AI response skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-20 rounded-full ml-2" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function SearchResultSkeleton() {
  return (
    <div className="glass rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
      <div className="flex items-center gap-4 pt-1">
        <Skeleton className="h-2 w-24" />
        <Skeleton className="h-1 flex-1 rounded-full" />
      </div>
    </div>
  );
}

export function KnowledgePanelSkeleton() {
  return (
    <div className="glass-gold rounded-xl p-5 space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-3 w-24" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function RadiologySkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Upload area skeleton */}
      <div className="rounded-2xl border-2 border-dashed border-white/[0.08] p-8 flex flex-col items-center gap-3">
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      {/* Model selector skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-lg" />
        ))}
      </div>
      {/* Findings skeleton */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-white/[0.08] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-1 w-36 rounded-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClinicalToolsSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
      {/* Input area skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      {/* Results skeleton */}
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-white/[0.08] p-4 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchPageSkeleton() {
  return (
    <div className="flex gap-6 p-4 w-full">
      <div className="flex-1 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SearchResultSkeleton key={i} />
        ))}
      </div>
      <div className="hidden lg:block w-80">
        <KnowledgePanelSkeleton />
      </div>
    </div>
  );
}
