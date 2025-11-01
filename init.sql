-- Guitar2Tabs 데이터베이스 초기화 스크립트

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 분석 작업 테이블
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    youtube_url VARCHAR(500) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,
    result_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 타브 악보 테이블
CREATE TABLE IF NOT EXISTS tabs (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES analysis_jobs(id),
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    tempo INTEGER DEFAULT 120,
    key_signature VARCHAR(10) DEFAULT 'C',
    mode VARCHAR(10) DEFAULT 'major',
    difficulty VARCHAR(20) DEFAULT 'beginner',
    duration INTEGER DEFAULT 0,
    tab_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 사용자 즐겨찾기 테이블
CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    tab_id INTEGER REFERENCES tabs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tab_id)
);

-- 태그 테이블
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 타브-태그 연결 테이블
CREATE TABLE IF NOT EXISTS tab_tags (
    tab_id INTEGER REFERENCES tabs(id),
    tag_id INTEGER REFERENCES tags(id),
    PRIMARY KEY (tab_id, tag_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_tabs_title ON tabs(title);
CREATE INDEX IF NOT EXISTS idx_tabs_artist ON tabs(artist);
CREATE INDEX IF NOT EXISTS idx_tabs_difficulty ON tabs(difficulty);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);

-- 기본 태그 삽입
INSERT INTO tags (name) VALUES 
    ('rock'), ('pop'), ('jazz'), ('blues'), ('classical'), 
    ('acoustic'), ('electric'), ('beginner'), ('intermediate'), ('advanced')
ON CONFLICT (name) DO NOTHING;

-- 샘플 데이터 (개발용)
INSERT INTO users (email, username, password_hash) VALUES 
    ('demo@guitar2tabs.com', 'demo', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/4Qz8K2') -- password: demo123
ON CONFLICT (email) DO NOTHING;

