import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./AppRoutes";
import WhatsAppGroup from "./WhatsAppGroup";

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <WhatsAppGroup />
    </BrowserRouter>
  );
}

export default App;
