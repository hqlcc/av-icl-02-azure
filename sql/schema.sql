IF OBJECT_ID(N'dbo.Sentimentos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sentimentos (
        EventId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Sentimentos PRIMARY KEY,
        SourceId NVARCHAR(100) NULL,
        Comentario NVARCHAR(MAX) NOT NULL,
        Sentimento VARCHAR(8) NOT NULL,
        SentimentoOriginal VARCHAR(8) NOT NULL,
        ScorePositive DECIMAL(6,5) NOT NULL,
        ScoreNeutral DECIMAL(6,5) NOT NULL,
        ScoreNegative DECIMAL(6,5) NOT NULL,
        ColetadoEm DATETIME2(3) NOT NULL,
        RegistradoEm DATETIME2(3) NOT NULL CONSTRAINT DF_Sentimentos_Registrado DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Sentimentos_Classe CHECK (Sentimento IN ('positive', 'neutral', 'negative')),
        CONSTRAINT CK_Sentimentos_Original CHECK (SentimentoOriginal IN ('positive', 'neutral', 'negative', 'mixed')),
        CONSTRAINT CK_Sentimentos_Scores CHECK (
            ScorePositive BETWEEN 0 AND 1 AND ScoreNeutral BETWEEN 0 AND 1 AND ScoreNegative BETWEEN 0 AND 1
        )
    );
    CREATE INDEX IX_Sentimentos_Sentimento ON dbo.Sentimentos(Sentimento);
END;
