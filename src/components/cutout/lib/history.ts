import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from "react";

type HistoryOptions<T> = {
	limit?: number;
	equals?: (left: T, right: T) => boolean;
};

type HistoryControls<T> = {
	setState: Dispatch<SetStateAction<T>>;
	resetState: (state: T) => void;
	beginTransaction: () => void;
	endTransaction: () => void;
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
};

const defaultEquals = <T>(left: T, right: T) => JSON.stringify(left) === JSON.stringify(right);

export function useHistoryState<T>(
	initialState: T | (() => T),
	{ limit = 100, equals = defaultEquals }: HistoryOptions<T> = {},
): [T, HistoryControls<T>] {
	const [state, setStateInternal] = useState(initialState);
	const [, setHistoryVersion] = useState(0);
	const stateRef = useRef(state);
	const pastRef = useRef<T[]>([]);
	const futureRef = useRef<T[]>([]);
	const transactionRef = useRef<{ snapshot: T } | null>(null);
	const transactionEndScheduledRef = useRef(false);
	stateRef.current = state;

	const notifyHistoryChange = useCallback(() => {
		setHistoryVersion((version) => version + 1);
	}, []);

	const pushPast = useCallback(
		(snapshot: T) => {
			pastRef.current.push(structuredClone(snapshot));
			if (pastRef.current.length > limit) pastRef.current.shift();
		},
		[limit],
	);

	const commitTransaction = useCallback(() => {
		const transaction = transactionRef.current;
		transactionRef.current = null;
		transactionEndScheduledRef.current = false;
		if (transaction === null || equals(transaction.snapshot, stateRef.current)) return;

		pushPast(transaction.snapshot);
		futureRef.current = [];
		notifyHistoryChange();
	}, [equals, notifyHistoryChange, pushPast]);

	const setState = useCallback<Dispatch<SetStateAction<T>>>(
		(action) => {
			const current = stateRef.current;
			const next = typeof action === "function" ? (action as (current: T) => T)(current) : action;
			if (equals(current, next)) return;

			if (transactionRef.current === null) {
				pushPast(current);
				futureRef.current = [];
				notifyHistoryChange();
			}

			stateRef.current = next;
			setStateInternal(next);
		},
		[equals, notifyHistoryChange, pushPast],
	);

	const resetState = useCallback((next: T) => {
		pastRef.current = [];
		futureRef.current = [];
		transactionRef.current = null;
		transactionEndScheduledRef.current = false;
		stateRef.current = next;
		setStateInternal(next);
		setHistoryVersion((version) => version + 1);
	}, []);

	const beginTransaction = useCallback(() => {
		if (transactionRef.current === null) {
			transactionRef.current = { snapshot: structuredClone(stateRef.current) };
		}
	}, []);

	const endTransaction = useCallback(() => {
		if (transactionRef.current === null || transactionEndScheduledRef.current) return;

		transactionEndScheduledRef.current = true;
		queueMicrotask(commitTransaction);
	}, [commitTransaction]);

	const undo = useCallback(() => {
		commitTransaction();
		const previous = pastRef.current.pop();
		if (!previous) return;

		futureRef.current.push(structuredClone(stateRef.current));
		stateRef.current = previous;
		setStateInternal(previous);
		notifyHistoryChange();
	}, [commitTransaction, notifyHistoryChange]);

	const redo = useCallback(() => {
		commitTransaction();
		const next = futureRef.current.pop();
		if (!next) return;

		pushPast(stateRef.current);
		stateRef.current = next;
		setStateInternal(next);
		notifyHistoryChange();
	}, [commitTransaction, notifyHistoryChange, pushPast]);

	return [
		state,
		{
			setState,
			resetState,
			beginTransaction,
			endTransaction,
			undo,
			redo,
			canUndo: pastRef.current.length > 0,
			canRedo: futureRef.current.length > 0,
		},
	];
}
