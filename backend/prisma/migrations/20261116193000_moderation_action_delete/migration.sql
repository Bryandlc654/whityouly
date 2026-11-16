-- Nueva medida de auditoría para bajas definitivas desde el panel de contenido.
ALTER TYPE "ModerationActionKind" ADD VALUE IF NOT EXISTS 'DELETE';
