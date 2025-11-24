import React from 'react';
import { FormControl } from 'baseui/form-control';
import { Input } from 'baseui/input';
import { Button } from 'baseui/button';
import { Card, StyledBody } from 'baseui/card';
import { styled } from 'baseui';
import { StyledLink } from 'baseui/link';

const AnyFormControl = FormControl as any;
const AnyInput = Input as any;

const Container = styled('div', {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  backgroundColor: '#f6f6f6',
});

interface RegistrationPageProps {
  onLogin: (user: { id: number; email: string; nickname?: string }) => void;
}

const RegistrationPage: React.FC<RegistrationPageProps> = ({ onLogin }) => {
  const [isLoginMode, setIsLoginMode] = React.useState(false); // Default to Register
  const [email, setEmail] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isValid, setIsValid] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleSubmit = async () => {
    setError(null);
    if (!validateEmail(email)) {
      setIsValid(false);
      setError('Invalid email address');
      return;
    }
    if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
    }
    
    if (!isLoginMode) {
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (!nickname.trim()) {
            setError("Nickname is required");
            return;
        }
    }

    setIsValid(true);
    setIsLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            email, 
            password, 
            nickname: isLoginMode ? undefined : nickname,
            mode: isLoginMode ? 'login' : 'register'
        }),
        credentials: 'include', // Important for cookies
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <Card
        overrides={{
          Root: { style: { width: '400px' } },
        }}
        title={isLoginMode ? "Welcome Back" : "Join the Group"}
      >
        <StyledBody>
          <AnyFormControl
            label="Email Address"
            error={!isValid && !validateEmail(email) ? "Please enter a valid email address" : null}
          >
            <AnyInput
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setEmail(e.currentTarget.value);
                setIsValid(true);
                setError(null);
              }}
              placeholder="user@example.com"
              error={!isValid}
              clearOnEscape
              disabled={isLoading}
            />
          </AnyFormControl>

          {!isLoginMode && (
              <AnyFormControl
                label="Nickname"
                caption="What should we call you?"
              >
                <AnyInput
                  value={nickname}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setNickname(e.currentTarget.value);
                    setError(null);
                  }}
                  placeholder="John Doe"
                  clearOnEscape
                  disabled={isLoading}
                />
              </AnyFormControl>
          )}

          <AnyFormControl
            label="Password"
            error={error}
          >
            <AnyInput
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setPassword(e.currentTarget.value);
                setError(null);
              }}
              type="password"
              placeholder="********"
              error={!!error}
              clearOnEscape
              disabled={isLoading}
            />
          </AnyFormControl>

          {!isLoginMode && (
            <AnyFormControl
                label="Confirm Password"
            >
                <AnyInput
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setConfirmPassword(e.currentTarget.value);
                    setError(null);
                }}
                type="password"
                placeholder="********"
                clearOnEscape
                disabled={isLoading}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                        handleSubmit();
                    }
                }}
                />
            </AnyFormControl>
          )}

          <Button 
            onClick={handleSubmit} 
            isLoading={isLoading}
            style={{ width: '100%', marginTop: '12px' }}
          >
            {isLoginMode ? "Login" : "Register"}
          </Button>

          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px' }}>
              {isLoginMode ? "Don't have an account? " : "Already have an account? "}
              <StyledLink 
                href="#" 
                onClick={(e) => {
                    e.preventDefault();
                    setIsLoginMode(!isLoginMode);
                    setError(null);
                }}
              >
                  {isLoginMode ? "Register" : "Login"}
              </StyledLink>
          </div>
        </StyledBody>
      </Card>
    </Container>
  );
};

export default RegistrationPage;
