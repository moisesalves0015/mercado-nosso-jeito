import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { buildSearchPath, normalizeSearchQuery } from '../../utils/homeProducts';

/** Busca rápida: usa o mesmo contrato `/search?q=` da página de busca (utils/homeProducts). */
export const HomeSearch = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const path = buildSearchPath(normalizeSearchQuery(value));
    // Consulta vazia: não navega.
    if (path) navigate(path);
  };

  return (
    <form onSubmit={handleSubmit} className="quick-search-wrapper" role="search">
      <div className="quick-search-container">
        <Search size={16} className="quick-search-icon" aria-hidden="true" />
        <label htmlFor="home-search-input" className="sr-only">O que você procura hoje?</label>
        <input
          id="home-search-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={80}
          placeholder="O que você procura hoje?"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="quick-search-input"
        />
      </div>
    </form>
  );
};
