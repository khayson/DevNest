package forge

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const apiBase = "https://forge.laravel.com/api/v1"

// Client talks to the Laravel Forge API.
type Client struct {
	Token string
	HTTP  *http.Client
}

func NewClient(token string) *Client {
	return &Client{
		Token: token,
		HTTP:  &http.Client{Timeout: 60 * time.Second},
	}
}

// DeploySite triggers a deployment on Forge for the given site ID.
func (c *Client) DeploySite(serverID, siteID int) error {
	if c.Token == "" {
		return fmt.Errorf("forge API token not configured")
	}
	url := fmt.Sprintf("%s/servers/%d/sites/%d/deploy", apiBase, serverID, siteID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader([]byte("{}")))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("forge deploy failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// ServerSite represents a Forge site listing entry.
type ServerSite struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Directory string `json:"directory"`
}

// ListSites returns sites on a Forge server.
func (c *Client) ListSites(serverID int) ([]ServerSite, error) {
	if c.Token == "" {
		return nil, fmt.Errorf("forge API token not configured")
	}
	url := fmt.Sprintf("%s/servers/%d/sites", apiBase, serverID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("forge list sites failed (%d): %s", resp.StatusCode, string(body))
	}
	var wrapper struct {
		Sites []ServerSite `json:"sites"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		return nil, err
	}
	return wrapper.Sites, nil
}
