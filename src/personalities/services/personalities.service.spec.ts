import { NotFoundException } from '@nestjs/common';
import { PersonalitiesService } from './personalities.service';

describe('PersonalitiesService', () => {
  const service = new PersonalitiesService();

  it('lists exactly the 4 personalities of the prototype', () => {
    expect(service.getAll()).toEqual([
      { id: 'maestro', name: 'El Maestro Decadente' },
      { id: 'terapeuta', name: 'El Terapeuta' },
      { id: 'maquina', name: 'La Máquina' },
      { id: 'hater', name: 'El Hater' },
    ]);
  });

  it('throws NotFoundException for an unknown id', () => {
    expect(() => service.getConfig('unknown')).toThrow(NotFoundException);
  });

  it('assembles the 7 sections in order and swaps section 4 with the spice level', () => {
    const mild = service.getSystemPrompt('hater', 'MILD');
    const cruel = service.getSystemPrompt('hater', 'CRUEL');

    expect(mild).toContain('1. IDENTIDAD');
    expect(mild).toContain('2. IDIOMA');
    expect(mild).toContain('3. TONO Y LENGUAJE');
    expect(mild).toContain('4. NIVEL DE PICANTE ACTIVO: MILD');
    expect(mild).toContain('5. REGLAS DE COMENTARIO');
    expect(mild).toContain('6. REGLAS DE LECTURA');
    expect(mild).toContain('7. FORMATO DE RESPUESTA');

    expect(cruel).toContain('4. NIVEL DE PICANTE ACTIVO: CRUEL');
    expect(cruel).not.toContain('4. NIVEL DE PICANTE ACTIVO: MILD');

    // Todo lo demás (identidad, idioma, tono, reglas, formato) es idéntico
    // entre niveles de picante: solo cambia la sección 4.
    const stripSpiceSection = (prompt: string) =>
      prompt.replace(/4\. NIVEL DE PICANTE ACTIVO:[\s\S]*?(?=\n\n5\.)/, '');
    expect(stripSpiceSection(mild)).toEqual(stripSpiceSection(cruel));
  });

  it("does not vary La Máquina's prompt across spice levels", () => {
    const mild = service.getSystemPrompt('maquina', 'MILD');
    const normal = service.getSystemPrompt('maquina', 'NORMAL');
    const cruel = service.getSystemPrompt('maquina', 'CRUEL');
    expect(mild).toEqual(normal);
    expect(normal).toEqual(cruel);
  });

  it('is the only personality allowed to mention centipawns/evaluations', () => {
    const maquina = service.getSystemPrompt('maquina', 'NORMAL');
    const hater = service.getSystemPrompt('hater', 'NORMAL');
    expect(maquina).toContain('centipeones');
    expect(hater).toContain('No mencionás centipeones');
  });

  it('exposes candidateWeights and talkFrequency per personality', () => {
    const maquina = service.getConfig('maquina');
    expect(maquina.candidateWeights).toEqual([1, 0, 0]);
    expect(maquina.talkFrequency).toBe(0.55);
  });

  it('injects candidateWeights/talkFrequency as a numeric reference section, before the response format', () => {
    const prompt = service.getSystemPrompt('hater', 'NORMAL');
    expect(prompt).toContain(
      'candidata 0 70%, candidata 1 25%, candidata 2 5%',
    );
    expect(prompt).toContain(
      'hablás (comment y/o read) en el 80% de los turnos',
    );
    expect(prompt.indexOf('SESGO NUMÉRICO')).toBeLessThan(
      prompt.indexOf('7. FORMATO DE RESPUESTA'),
    );
  });
});
