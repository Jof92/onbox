import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Containers from './components/Containers';
import Cards from './components/Cards'; // ⬅️ importar Cards.jsx
import './index.css';

function App() {
  return (
    <Router>
      <Header />
      <main>
        <Routes>
          {/* Página inicial (login/cadastro) */}
          <Route path="/" element={<h2>Bem-vindo ao ONBOX</h2>} />

          {/* Página Containers (após login) */}
          <Route path="/containers" element={<Containers />} />

          {/* Página Cards de um projeto */}
          <Route path="/cards/:projectName" element={<Cards />} />
        </Routes>
      </main>
      <Footer />
    </Router>
  );
}

export default App;
