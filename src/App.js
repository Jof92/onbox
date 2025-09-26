import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Containers from './components/Containers'; // ⬅️ importe a nova página
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
        </Routes>
      </main>
      <Footer />
    </Router>
  );
}

export default App;
