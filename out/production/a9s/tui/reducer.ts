import { produce } from "immer";

export type TuiMode = "normal" | "search";

export interface TuiState {
  mode: TuiMode;
  searchQuery: string;
  selectedRouter: number;
  topIndex: number;
}

export type TuiAction =
  | { type: "SET_MODE"; payload: TuiMode }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_SELECTED_ROUTER"; payload: number }
  | { type: "MOVE_UP"; payload: { filteredRoutersLength: number } }
  | {
      type: "MOVE_DOWN";
      payload: { filteredRoutersLength: number; visibleCount: number };
    };

export const initialState: TuiState = {
  mode: "normal",
  searchQuery: "",
  selectedRouter: 0,
  topIndex: 0,
};

export const tuiReducer = produce((draft: TuiState, action: TuiAction) => {
  switch (action.type) {
    case "SET_MODE":
      draft.mode = action.payload;
      break;
    case "SET_SEARCH_QUERY":
      draft.searchQuery = action.payload;
      // Reset selection to top when search changes
      draft.selectedRouter = 0;
      draft.topIndex = 0;
      break;
    case "SET_SELECTED_ROUTER":
      draft.selectedRouter = action.payload;
      break;
    case "MOVE_DOWN":
      if (draft.selectedRouter < action.payload.filteredRoutersLength - 1) {
        const newIndex = draft.selectedRouter + 1;
        // If new selection would be below visible area, scroll down
        if (newIndex >= draft.topIndex + action.payload.visibleCount) {
          draft.topIndex = draft.topIndex + 1;
        }
        draft.selectedRouter = newIndex;
      }
      break;
    case "MOVE_UP":
      if (draft.selectedRouter > 0) {
        const newIndex = draft.selectedRouter - 1;
        // If new selection would be above visible area, scroll up
        if (newIndex < draft.topIndex) {
          draft.topIndex = draft.topIndex - 1;
        }
        draft.selectedRouter = newIndex;
      }
      break;
  }
});
