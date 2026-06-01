import { createBrowserRouter } from "react-router-dom";
import { StockForecast } from "./pages/StockForecast";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <StockForecast />,
    },
]);