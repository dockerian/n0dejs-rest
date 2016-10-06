var orm = require('orm'),
  utils = require('../../utils');

module.exports = function ProjectModel(db) {
  var project = db.define('project', {
    name: {
      type: 'text',
      required: true
    },
    last_commit_sha: {
      type: 'text'
    },
    token: {
      type: 'text'
    },
    repo_name: {
      type: 'text',
      required: true
    },
    repo_owner: {
      type: 'text'
    },
    repo_branch: {
      type: 'text'
    },
    repo_cloneUrl: {
      type: 'text'
    },
    repo_httpUrl: {
      type: 'text'
    },
    repo_sshUrl: {
      type: 'text'
    },
    repo_githubRepoId: {
      type: 'text'
    },
    repo_webHookId: {
      type: 'text'
    },
    repo_webhookUrl: {
      type: 'text'
    },
    repo_secret: {
      type: 'text'
    },
    join_code: {
      type: 'text'
    },
    credential_id: {
      type: 'integer'
    },
    application_image_id: {
      type: 'number'
    },
    build_container_id: {
      type: 'integer',
      required: true
    },
    deployment_target_id: {
      type: 'integer',
      required: true
    }
  }, {
    methods: {
      serialize: function () {
        var userInstance = this.user;
        var applicationImage = this.application;
        return {
          id: this.id,
          name: this.name,
          join_code: this.join_code,
          last_commit_sha: this.last_commit_sha,
          statistics: this.statistics,
          application_image: applicationImage,
          application_image_id: this.application_image_id,
          build_container_id: this.build_container_id,
          deployment_target_id: this.deployment_target_id,
          credential_id: this.credential_id,
          vcs_id: this.vcs_id,
          user_id: this.user_id,
          user: userInstance,
          repo: {
            full_name: (this.repo_owner ? this.repo_owner + '/' : '') + this.repo_name,
            name: this.repo_name,
            owner: this.repo_owner,
            github_repo_id: this.repo_githubRepoId,
            branch: this.repo_branch,
            clone_url: this.repo_cloneUrl,
            http_url: this.repo_httpUrl,
            ssh_url: this.repo_sshUrl,
            webhook_id: String(this.repo_webHookId)
          }
        };
      },
      serializeWithSecret: function () {
        var serialized = this.serialize();

        serialized.token = this.token;
        serialized.repo.secret = this.repo_secret;

        return serialized;
      }
    }
  });
};
