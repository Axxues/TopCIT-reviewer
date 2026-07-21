import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Practice from './pages/Practice';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/practice/:diagramType" element={<Practice />} />
    </Routes>
  );
}
