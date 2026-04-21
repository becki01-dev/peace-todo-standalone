import { useOutletContext } from "react-router-dom";
import FitHistory from "./FitHistory";

const FitHistoryRoute = () => {
  const { reloadKey } = useOutletContext<{ reloadKey: number }>();
  return <FitHistory reloadKey={reloadKey} />;
};

export default FitHistoryRoute;
