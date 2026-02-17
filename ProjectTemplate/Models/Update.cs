using System;

namespace ProjectTemplate.Models
{
    public class Update
    {
        public string PostId { get; set; } // Reference to the post/feedback
        public string Content { get; set; }
        public string AuthorRole { get; set; } // Employer/Admin
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
