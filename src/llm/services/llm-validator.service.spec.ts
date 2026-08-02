import { LlmValidatorService } from './llm-validator.service';

describe('LlmValidatorService', () => {
  const validator = new LlmValidatorService();

  const validResponse = {
    chosenCandidate: 1,
    skipComment: false,
    comment: 'Interesante que protejas ese peón justo ahora...',
    commentType: 'COMMENT',
    skipRead: false,
    read: 'No toques el caballo todavía.',
    readConfidence: 'high',
    verdictText: 'Sabía que ibas a hacer eso.',
  };

  function validate(overrides: object, hadActivePrediction = false) {
    return validator.validate(
      JSON.stringify({ ...validResponse, ...overrides }),
      { hadActivePrediction },
    );
  }

  function withoutField(key: keyof typeof validResponse): string {
    const clone: Record<string, unknown> = { ...validResponse };
    delete clone[key];
    return JSON.stringify(clone);
  }

  describe('Nivel 1 — fallo total', () => {
    it('treats unparseable JSON as invalid_json', () => {
      const { result, fieldsAffected } = validator.validate('not json{{', {
        hadActivePrediction: false,
      });
      expect(result).toMatchObject({
        chosenCandidate: 0,
        comment: null,
        read: null,
        degradationLevel: 1,
        failureReason: 'invalid_json',
      });
      expect(fieldsAffected).toEqual([]);
    });

    it('treats a missing chosenCandidate as missing_chosen_candidate', () => {
      const { result } = validator.validate(withoutField('chosenCandidate'), {
        hadActivePrediction: false,
      });
      expect(result.degradationLevel).toBe(1);
      expect(result.failureReason).toBe('missing_chosen_candidate');
      expect(result.chosenCandidate).toBe(0);
    });

    it('treats an out-of-range chosenCandidate as out_of_range_candidate', () => {
      const { result } = validate({ chosenCandidate: 3 });
      expect(result.degradationLevel).toBe(1);
      expect(result.failureReason).toBe('out_of_range_candidate');
      expect(result.chosenCandidate).toBe(0);
    });

    it('treats a wrong-typed chosenCandidate as out_of_range_candidate', () => {
      const { result } = validate({ chosenCandidate: '1' });
      expect(result.failureReason).toBe('out_of_range_candidate');
    });
  });

  describe('camino feliz (degradationLevel 0)', () => {
    it('keeps the chosen move even without any prediction context', () => {
      const { result, fieldsAffected } = validate({}, false);
      expect(result).toEqual({
        chosenCandidate: 1,
        comment: validResponse.comment,
        commentType: 'COMMENT',
        verdictText: null, // no había predicción activa, se ignora aunque venga
        read: validResponse.read,
        readConfidence: 'high',
        degradationLevel: 0,
        failureReason: null,
      });
      expect(fieldsAffected).toEqual([]);
    });

    it('includes verdictText when there was an active prediction', () => {
      const { result } = validate({}, true);
      expect(result.verdictText).toBe(validResponse.verdictText);
      expect(result.degradationLevel).toBe(0);
    });

    it('honors skipComment and skipRead without counting as degradation', () => {
      const { result, fieldsAffected } = validate({
        skipComment: true,
        skipRead: true,
      });
      expect(result.comment).toBeNull();
      expect(result.commentType).toBeNull();
      expect(result.read).toBeNull();
      expect(result.readConfidence).toBeNull();
      expect(result.degradationLevel).toBe(0);
      expect(fieldsAffected).toEqual([]);
    });
  });

  describe('Nivel 2 — fallo parcial (el movimiento se ejecuta igual)', () => {
    it('nulls comment when it is missing but not skipped', () => {
      const { result, fieldsAffected } = validator.validate(
        withoutField('comment'),
        { hadActivePrediction: false },
      );
      expect(result.chosenCandidate).toBe(1);
      expect(result.comment).toBeNull();
      expect(result.commentType).toBeNull();
      expect(result.read).toBe(validResponse.read); // no afectado
      expect(result.degradationLevel).toBe(2);
      expect(fieldsAffected).toEqual(['comment']);
      expect(result.failureReason).toBe('invalid_comment');
    });

    it('nulls both comment and commentType when commentType is invalid', () => {
      const { result, fieldsAffected } = validate({
        commentType: 'NOT_A_TYPE',
      });
      expect(result.comment).toBeNull();
      expect(result.commentType).toBeNull();
      expect(fieldsAffected).toEqual(['commentType']);
      expect(result.failureReason).toBe('invalid_comment_type');
    });

    it('nulls read when it is missing but not skipped', () => {
      const { result, fieldsAffected } = validator.validate(
        withoutField('read'),
        { hadActivePrediction: false },
      );
      expect(result.read).toBeNull();
      expect(result.readConfidence).toBeNull();
      expect(result.comment).toBe(validResponse.comment); // no afectado
      expect(fieldsAffected).toEqual(['read']);
    });

    it('nulls read when readConfidence is invalid', () => {
      const { result, fieldsAffected } = validate({
        readConfidence: 'super-high',
      });
      expect(result.read).toBeNull();
      expect(result.readConfidence).toBeNull();
      expect(fieldsAffected).toEqual(['readConfidence']);
      expect(result.failureReason).toBe('invalid_confidence');
    });

    it('nulls verdictText when missing but a prediction was active', () => {
      const { result, fieldsAffected } = validator.validate(
        withoutField('verdictText'),
        { hadActivePrediction: true },
      );
      expect(result.verdictText).toBeNull();
      expect(result.chosenCandidate).toBe(1);
      expect(result.comment).toBe(validResponse.comment); // no afectado
      expect(fieldsAffected).toEqual(['verdictText']);
    });

    it('accumulates independent failures across fields', () => {
      const { result, fieldsAffected } = validate({
        comment: '',
        readConfidence: 'nope',
      });
      expect(fieldsAffected).toEqual(['comment', 'readConfidence']);
      expect(result.failureReason).toBe('invalid_comment,invalid_confidence');
      expect(result.degradationLevel).toBe(2);
    });
  });
});
