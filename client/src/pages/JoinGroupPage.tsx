import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import RegistrationPage from './RegistrationPage';
import { styled } from 'baseui';
import { Spinner } from 'baseui/spinner';
import { Card, StyledBody } from 'baseui/card';

const Container = styled('div', {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  backgroundColor: '#f6f6f6',
});

interface User {
    id: number;
    email: string;
    nickname?: string;
}

interface JoinGroupPageProps {
    user: User | null;
    onLogin: (user: User) => void;
}

const JoinGroupPage: React.FC<JoinGroupPageProps> = ({ user, onLogin }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const inviteCode = searchParams.get('code');
    const [status, setStatus] = useState<string>('Checking invite...');
    const [error, setError] = useState<string | null>(null);

    const joinGroup = async () => {
        if (!inviteCode) {
            setError('Invalid invite link');
            return;
        }

        setStatus('Joining group...');
        try {
            const res = await fetch('/api/groups/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode }),
                credentials: 'include'
            });
            
            const data = await res.json();
            
            if (res.ok) {
                // Success!
                setStatus('Joined successfully! Redirecting...');
                setTimeout(() => navigate('/welcome'), 1000);
            } else {
                if (data.error === 'Already a member of this group') {
                     // That's fine, just redirect
                     navigate('/welcome');
                } else {
                    setError(data.error || 'Failed to join group');
                }
            }
        } catch (e) {
            setError('Network error joining group');
        }
    };

    useEffect(() => {
        // If user is logged in, try to join immediately
        if (user && inviteCode) {
            joinGroup();
        }
    }, [user, inviteCode]);

    const handleLoginSuccess = (userData: any) => {
        onLogin(userData);
        // The useEffect will trigger joinGroup now that user is set
    };

    if (!inviteCode) {
        return (
            <Container>
                <Card title="Error">
                    <StyledBody>Invalid invite link.</StyledBody>
                </Card>
            </Container>
        );
    }

    if (!user) {
        return (
            <div>
                <div style={{ textAlign: 'center', padding: '20px', background: '#e0f7fa', color: '#006064' }}>
                    You've been invited to join a group! Please login or register to continue.
                </div>
                <RegistrationPage onLogin={handleLoginSuccess} />
            </div>
        );
    }

    return (
        <Container>
            <Card title="Joining Group">
                <StyledBody style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {error ? (
                        <div style={{ color: 'red' }}>{error}</div>
                    ) : (
                        <>
                            <Spinner />
                            <p style={{ marginTop: '20px' }}>{status}</p>
                        </>
                    )}
                </StyledBody>
            </Card>
        </Container>
    );
};

export default JoinGroupPage;

